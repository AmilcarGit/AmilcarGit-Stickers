import type { Deps } from "./deps";
import { AppError } from "./errors";
import { hit } from "./store";
import { randomBytes } from "node:crypto";
import { sha256 } from "./tokens";
import { getUser, type UserRecord } from "./users";

export const PLANS = {
  free: { label: "Free", perDay: 100, perMinute: 30 },
  pro: { label: "Pro", perDay: 2000, perMinute: 120 },
  ultra: { label: "Ultra", perDay: 10000, perMinute: 300 },
} as const;
export type PlanId = keyof typeof PLANS;

export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;
export const planOf = (u: UserRecord): PlanId => (isPlanId(u.plan) ? u.plan : "free");

export const MAX_KEYS_PER_USER = 5;
const KEY_PREFIX = "amk_";
/** Perú no cambia de hora: el día de cuota se reinicia a las 00:00 de Lima (UTC-5). */
const DAY_OFFSET_MS = -5 * 3600 * 1000;

type KeyRecord = { id: string; uid: string; name: string; prefix: string; createdAt: number; lastUsedAt: number };
export type KeyInfo = Omit<KeyRecord, "uid">;

export function dayStamp(nowMs: number): string {
  return new Date(nowMs + DAY_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, "");
}

/** Milisegundos hasta la próxima medianoche de Lima. */
export function nextResetMs(nowMs: number): number {
  const shifted = nowMs + DAY_OFFSET_MS;
  const nextMidnight = (Math.floor(shifted / 86_400_000) + 1) * 86_400_000;
  return nextMidnight - DAY_OFFSET_MS;
}

const hashOf = (key: string) => sha256(key);
const toInfo = (r: KeyRecord): KeyInfo => ({ id: r.id, name: r.name, prefix: r.prefix, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt });

export async function createApiKey(d: Deps, user: UserRecord, rawName: unknown, nowMs = Date.now()): Promise<{ key: string; info: KeyInfo }> {
  if (!user.emailVerified) throw new AppError(403, "Verifica tu correo electrónico antes de crear claves de API.");
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 40) : "";
  if (!name) throw new AppError(400, "Ponle un nombre a la clave (por ejemplo, «Mi bot»).");
  if ((await d.store.zcard(`apikeys:${user.uid}`)) >= MAX_KEYS_PER_USER) {
    throw new AppError(403, `Llegaste al máximo de ${MAX_KEYS_PER_USER} claves. Revoca alguna para crear otra.`);
  }
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  const hash = hashOf(key);
  const rec: KeyRecord = { id: hash.slice(0, 16), uid: user.uid, name, prefix: key.slice(0, 8), createdAt: nowMs, lastUsedAt: 0 };
  await d.store.set(`apikey:${hash}`, rec);
  await d.store.zadd(`apikeys:${user.uid}`, nowMs, hash);
  return { key, info: toInfo(rec) };
}

export async function listApiKeys(d: Deps, uid: string): Promise<KeyInfo[]> {
  const hashes = await d.store.zrange(`apikeys:${uid}`, 0, MAX_KEYS_PER_USER - 1, true);
  const recs = await d.store.mget<KeyRecord>(hashes.map((h) => `apikey:${h}`));
  return recs.filter((r): r is KeyRecord => r !== null && r.uid === uid).map(toInfo);
}

export async function revokeApiKey(d: Deps, uid: string, id: string): Promise<void> {
  const hashes = await d.store.zrange(`apikeys:${uid}`, 0, MAX_KEYS_PER_USER - 1, true);
  const hash = hashes.find((h) => h.startsWith(id) && id.length === 16);
  if (!hash) throw new AppError(404, "Clave no encontrada.");
  await d.store.del(`apikey:${hash}`);
  await d.store.zrem(`apikeys:${uid}`, hash);
}

export type Quota = { plan: PlanId; limit: number; used: number; remaining: number; resetAt: number };

export async function quotaFor(d: Deps, user: UserRecord, nowMs = Date.now()): Promise<Quota> {
  const plan = planOf(user);
  const limit = PLANS[plan].perDay;
  const used = Math.min(limit, (await d.store.get<number>(`quota:${user.uid}:${dayStamp(nowMs)}`)) ?? 0);
  return { plan, limit, used, remaining: limit - used, resetAt: nextResetMs(nowMs) };
}

/**
 * Valida la clave y descuenta una solicitud de la cuota diaria. Lanza 401 (clave mala),
 * 429 (límite por minuto o diario agotado).
 */
export async function authenticateApiKey(d: Deps, raw: string | null, nowMs = Date.now()): Promise<{ user: UserRecord; keyId: string; quota: Quota }> {
  if (!raw) throw new AppError(401, "Falta la clave de API. Envíala en el encabezado x-api-key.");
  if (!raw.startsWith(KEY_PREFIX) || raw.length < 20 || raw.length > 80) throw new AppError(401, "Clave de API inválida.");
  const hash = hashOf(raw);
  const rec = await d.store.get<KeyRecord>(`apikey:${hash}`);
  const user = rec ? await getUser(d, rec.uid) : null;
  if (!rec || !user) throw new AppError(401, "Clave de API inválida o revocada.");

  const plan = planOf(user);
  if (!(await hit(d.store, `rl:api:${user.uid}`, PLANS[plan].perMinute, 60))) {
    throw new AppError(429, "Demasiadas solicitudes por minuto. Espera unos segundos.");
  }
  const key = `quota:${user.uid}:${dayStamp(nowMs)}`;
  const used = await d.store.incr(key);
  if (used === 1) await d.store.expire(key, 2 * 86_400);
  const limit = PLANS[plan].perDay;
  if (used > limit) throw new AppError(429, `Agotaste las ${limit} solicitudes de hoy. Se renuevan a las 12 a. m. (hora de Lima).`);

  if (nowMs - rec.lastUsedAt > 60_000) await d.store.set(`apikey:${hash}`, { ...rec, lastUsedAt: nowMs });
  return { user, keyId: rec.id, quota: { plan, limit, used, remaining: limit - used, resetAt: nextResetMs(nowMs) } };
}

export async function setUserPlan(d: Deps, uid: string, plan: unknown): Promise<void> {
  if (!isPlanId(plan)) throw new AppError(400, "Plan no válido.");
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Usuario no encontrado.");
  await d.store.set(`user:${uid}`, { ...user, plan });
}
