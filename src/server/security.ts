import { isIP } from "node:net";
import type { Deps } from "./deps";
import { AppError } from "./errors";
import { newId } from "./tokens";

export type SecurityEvent = {
  id: string;
  at: number;
  type: "api_key_rejected" | "rate_limited" | "ip_blocked" | "ip_unblocked";
  severity: "warning" | "critical" | "info";
  ip: string;
  path: string;
  detail: string;
};

export type IpBlock = { ip: string; reason: string; blockedAt: number; expiresAt: number };

const EVENT_KEY = "security:events";
const BLOCK_INDEX = "security:blocks";
const blockKey = (ip: string) => `security:block:${ip}`;

export function normalizeSecurityIp(value: unknown): string {
  if (typeof value !== "string") throw new AppError(400, "Escribe una dirección IP válida.");
  const ip = value.trim();
  if (!ip || ip.length > 45 || isIP(ip) === 0) throw new AppError(400, "La dirección IP no es válida.");
  return ip;
}

export async function recordSecurityEvent(
  d: Deps,
  event: Omit<SecurityEvent, "id" | "at">,
  nowMs = Date.now(),
): Promise<void> {
  const row: SecurityEvent = { ...event, id: newId("sec"), at: nowMs };
  await d.store.zadd(EVENT_KEY, nowMs, JSON.stringify(row));
  if (await d.store.zcard(EVENT_KEY) > 300) {
    const old = await d.store.zrange(EVENT_KEY, 0, -301);
    for (const item of old) await d.store.zrem(EVENT_KEY, item);
  }
}

export async function isIpBlocked(d: Deps, rawIp: string): Promise<IpBlock | null> {
  if (!rawIp || rawIp === "anon") return null;
  const ip = rawIp.trim();
  const block = await d.store.get<IpBlock>(blockKey(ip));
  if (!block || block.expiresAt <= Date.now()) {
    if (!block) await d.store.zrem(BLOCK_INDEX, ip);
    return null;
  }
  return block;
}

export async function blockIp(
  d: Deps,
  rawIp: unknown,
  durationSeconds: unknown,
  rawReason?: unknown,
  nowMs = Date.now(),
): Promise<IpBlock> {
  const ip = normalizeSecurityIp(rawIp);
  if (!Number.isInteger(durationSeconds) || Number(durationSeconds) < 60 || Number(durationSeconds) > 2_592_000) {
    throw new AppError(400, "La duración debe estar entre 1 minuto y 30 días.");
  }
  const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 120) : "";
  const block: IpBlock = { ip, reason: reason || "Bloqueo manual del administrador", blockedAt: nowMs, expiresAt: nowMs + Number(durationSeconds) * 1000 };
  await d.store.set(blockKey(ip), block, { ex: Number(durationSeconds) });
  await d.store.zadd(BLOCK_INDEX, block.expiresAt, ip);
  await recordSecurityEvent(d, { type: "ip_blocked", severity: "critical", ip, path: "/admin/security", detail: block.reason }, nowMs);
  return block;
}

export async function unblockIp(d: Deps, rawIp: unknown, nowMs = Date.now()): Promise<void> {
  const ip = normalizeSecurityIp(rawIp);
  const current = await d.store.get<IpBlock>(blockKey(ip));
  await d.store.del(blockKey(ip));
  await d.store.zrem(BLOCK_INDEX, ip);
  if (current) await recordSecurityEvent(d, { type: "ip_unblocked", severity: "info", ip, path: "/admin/security", detail: "Bloqueo retirado por un administrador" }, nowMs);
}

export async function securitySnapshot(d: Deps): Promise<{ events: SecurityEvent[]; blocks: IpBlock[] }> {
  const [eventRows, ips] = await Promise.all([
    d.store.zrange(EVENT_KEY, 0, 99, true),
    d.store.zrange(BLOCK_INDEX, 0, 99, true),
  ]);
  const events = eventRows.flatMap((raw) => {
    try { return [JSON.parse(raw) as SecurityEvent]; } catch { return []; }
  });
  const stored = await d.store.mget<IpBlock>(ips.map(blockKey));
  const blocks: IpBlock[] = [];
  for (let i = 0; i < ips.length; i++) {
    const block = stored[i];
    if (block && block.expiresAt > Date.now()) blocks.push(block);
    else await d.store.zrem(BLOCK_INDEX, ips[i]);
  }
  return { events, blocks };
}
