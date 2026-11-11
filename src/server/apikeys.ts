import { recordUsage } from "./profile";
import type { Deps } from "./deps";
import { AppError } from "./errors";
import { hit } from "./store";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sha256 } from "./tokens";
import { getUser, recordUserActivity, recordAdminAction, type UserRecord } from "./users";

export const PLANS = {
  free: { label: "Free", perDay: 100, perMinute: 30 },
  pro: { label: "Pro", perDay: 2000, perMinute: 120 },
  ultra: { label: "Ultra", perDay: 10000, perMinute: 300 },
} as const;
export type PlanId = string;
export type PlanConfig = { id: string; label: string; perDay: number; perMinute: number };
export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && /^[a-z][a-z0-9_-]{1,39}$/.test(v);
export const planOf = (u: UserRecord): PlanId => (isPlanId(u.plan) ? u.plan : "free");

export const MAX_KEYS_PER_USER = 5;
const KEY_PREFIX = "amk_";
const DAY_OFFSET_MS = -5 * 3600 * 1000;

type KeyRecord = { id: string; uid: string; name: string; prefix: string; createdAt: number; lastUsedAt: number; dailyLimit?: number | null; minuteLimit?: number | null; encryptedKey?: string };
export type KeyInfo = Omit<KeyRecord, "uid">;
export type Quota = { plan: PlanId; limit: number; used: number; remaining: number; resetAt: number };
export type KeyUsage = { day: string; requests: number };

export function dayStamp(nowMs: number): string {
  return new Date(nowMs + DAY_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, "");
}
export function nextResetMs(nowMs: number): number {
  const shifted = nowMs + DAY_OFFSET_MS;
  const nextMidnight = (Math.floor(shifted / 86_400_000) + 1) * 86_400_000;
  return nextMidnight - DAY_OFFSET_MS;
}
const hashOf = (key: string) => sha256(key);
function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) throw new AppError(500, "La configuración segura de claves no está disponible.");
  return createHash("sha256").update("YuiAPI API key encryption v1:").update(secret).digest();
}
function encryptKey(key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
function decryptKey(value: string): string {
  const [ivText, tagText, dataText] = value.split(".");
  if (!ivText || !tagText || !dataText) throw new AppError(500, "No se pudo descifrar la clave.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new AppError(500, "No se pudo descifrar la clave. Comprueba la configuración del servidor.");
  }
}
const toInfo = (r: KeyRecord): KeyInfo => ({ id: r.id, name: r.name, prefix: r.prefix, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt, dailyLimit: r.dailyLimit ?? null, minuteLimit: r.minuteLimit ?? null });

export async function getPlanConfig(d: Deps, id: string): Promise<PlanConfig | null> {
  if (Object.prototype.hasOwnProperty.call(PLANS, id)) return { id, ...PLANS[id as keyof typeof PLANS] };
  return d.store.get<PlanConfig>(`plan:${id}`);
}
export async function listPlans(d: Deps): Promise<PlanConfig[]> {
  const ids = await d.store.zrange("plans:custom", 0, 99, true);
  const custom = await d.store.mget<PlanConfig>(ids.map((id) => `plan:${id}`));
  return [...Object.entries(PLANS).map(([id, p]) => ({ id, ...p })), ...custom.filter((p): p is PlanConfig => p !== null)];
}
export async function saveCustomPlan(d: Deps, input: { id?: unknown; label?: unknown; perDay?: unknown; perMinute?: unknown }): Promise<PlanConfig> {
  const id = typeof input.id === "string" ? input.id : `custom_${randomBytes(5).toString("hex")}`;
  const label = typeof input.label === "string" ? input.label.trim().slice(0, 32) : "";
  if (!/^custom_[a-f0-9]{10}$/.test(id) || !label) throw new AppError(400, "Identificador o nombre del plan no válido.");
  if (!Number.isInteger(input.perDay) || Number(input.perDay) < 1 || Number(input.perDay) > 1000000 || !Number.isInteger(input.perMinute) || Number(input.perMinute) < 1 || Number(input.perMinute) > 10000) throw new AppError(400, "Límites de plan no válidos.");
  const plan = { id, label, perDay: Number(input.perDay), perMinute: Number(input.perMinute) };
  await d.store.set(`plan:${id}`, plan);
  await d.store.zadd("plans:custom", Date.now(), id);
  return plan;
}
export async function deleteCustomPlan(d: Deps, id: string): Promise<void> {
  if (!/^custom_[a-f0-9]{10}$/.test(id)) throw new AppError(400, "Solo puedes eliminar planes personalizados.");
  const users = await d.store.zrange("users", 0, -1);
  const records = await d.store.mget<UserRecord>(users.map((uid) => `user:${uid}`));
  if (records.some((u) => u?.plan === id)) throw new AppError(409, "No puedes eliminar un plan que todavía está asignado a usuarios.");
  await d.store.del(`plan:${id}`);
  await d.store.zrem("plans:custom", id);
}
export async function effectivePlan(d: Deps, user: UserRecord, nowMs = Date.now()): Promise<{ id: string; config: PlanConfig }> {
  const id = user.planExpiresAt && user.planExpiresAt <= nowMs ? "free" : planOf(user);
  const config = await getPlanConfig(d, id);
  if (!config) return { id: "free", config: { id: "free", ...PLANS.free } };
  return { id, config };
}

async function createKeyForUser(d: Deps, user: UserRecord, rawName: unknown, allowUnverified: boolean, nowMs = Date.now(), skipMax = false): Promise<{ key: string; info: KeyInfo }> {
  if (!allowUnverified && !user.emailVerified) throw new AppError(403, "Verifica tu correo electrónico antes de crear claves de API.");
  if (user.status === "suspended") throw new AppError(403, "No puedes crear claves para una cuenta suspendida.");
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 40) : "";
  if (!name) throw new AppError(400, "Ponle un nombre a la clave (por ejemplo, «Mi bot»).");
  if (!skipMax && (await d.store.zcard(`apikeys:${user.uid}`)) >= MAX_KEYS_PER_USER) throw new AppError(403, `Llegaste al máximo de ${MAX_KEYS_PER_USER} claves. Revoca alguna para crear otra.`);
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  const hash = hashOf(key);
  const rec: KeyRecord = { id: hash.slice(0, 16), uid: user.uid, name, prefix: key.slice(0, 8), createdAt: nowMs, lastUsedAt: 0, dailyLimit: null, minuteLimit: null, encryptedKey: encryptKey(key) };
  await d.store.set(`apikey:${hash}`, rec);
  await d.store.zadd(`apikeys:${user.uid}`, nowMs, hash);
  return { key, info: toInfo(rec) };
}
export async function createApiKey(d: Deps, user: UserRecord, rawName: unknown, nowMs = Date.now()) {
  return createKeyForUser(d, user, rawName, false, nowMs);
}
export async function createAdminApiKey(d: Deps, uid: string, rawName: unknown) {
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Usuario no encontrado.");
  return createKeyForUser(d, user, rawName, true);
}
async function findKey(d: Deps, uid: string, id: string): Promise<{ hash: string; rec: KeyRecord }> {
  const hashes = await d.store.zrange(`apikeys:${uid}`, 0, -1, true);
  const hash = hashes.find((h) => h.startsWith(id) && id.length === 16);
  const rec = hash ? await d.store.get<KeyRecord>(`apikey:${hash}`) : null;
  if (!hash || !rec || rec.uid !== uid) throw new AppError(404, "Clave no encontrada.");
  return { hash, rec };
}
export async function listApiKeys(d: Deps, uid: string): Promise<KeyInfo[]> {
  const hashes = await d.store.zrange(`apikeys:${uid}`, 0, MAX_KEYS_PER_USER - 1, true);
  const recs = await d.store.mget<KeyRecord>(hashes.map((h) => `apikey:${h}`));
  return recs.filter((r): r is KeyRecord => r !== null && r.uid === uid).map(toInfo);
}
export async function listAdminApiKeys(d: Deps, uid: string): Promise<KeyInfo[]> {
  return listApiKeys(d, uid);
}
export async function getApiKeySecret(d: Deps, uid: string, id: string): Promise<string> {
  const { rec } = await findKey(d, uid, id);
  if (!rec.encryptedKey) throw new AppError(409, "Esta clave es anterior al guardado cifrado y no se puede recuperar. Revócala y crea una nueva.");
  return decryptKey(rec.encryptedKey);
}
export async function revokeApiKey(d: Deps, uid: string, id: string): Promise<void> {
  const { hash } = await findKey(d, uid, id);
  await d.store.del(`apikey:${hash}`);
  await d.store.zrem(`apikeys:${uid}`, hash);
}
export async function updateApiKeyLimits(d: Deps, uid: string, id: string, patch: { dailyLimit?: unknown; minuteLimit?: unknown }): Promise<KeyInfo> {
  const { hash, rec } = await findKey(d, uid, id);
  const next = { ...rec };
  for (const [field, max] of [["dailyLimit", 1000000], ["minuteLimit", 10000]] as const) {
    const value = patch[field];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max)) throw new AppError(400, `El límite ${field === "dailyLimit" ? "diario" : "por minuto"} debe ser null o un entero válido.`);
    next[field] = value as number | null;
  }
  await d.store.set(`apikey:${hash}`, next);
  return toInfo(next);
}
export async function rotateApiKey(d: Deps, uid: string, id: string): Promise<{ key: string; info: KeyInfo }> {
  const { rec } = await findKey(d, uid, id);
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Usuario no encontrado.");
  const created = await createKeyForUser(d, user, rec.name, true, Date.now(), true);
  try { await revokeApiKey(d, uid, id); }
  catch (error) { await revokeApiKey(d, uid, created.info.id); throw error; }
  return created;
}
export async function listApiKeyUsage(d: Deps, uid: string, id: string): Promise<KeyUsage[]> {
  const { rec } = await findKey(d, uid, id);
  const days = await d.store.zrange(`apikey-days:${rec.id}`, 0, 29, true);
  const values = await Promise.all(days.map((day) => d.store.hget(`apikey-usage:${rec.id}:${day}`, "requests")));
  return days.map((day, i) => ({ day, requests: values[i] }));
}
export async function quotaFor(d: Deps, user: UserRecord, nowMs = Date.now()): Promise<Quota> {
  const active = await effectivePlan(d, user, nowMs);
  const limit = user.dailyLimit ?? active.config.perDay;
  const used = Math.min(limit, (await d.store.get<number>(`quota:${user.uid}:${dayStamp(nowMs)}`)) ?? 0);
  return { plan: active.id, limit, used, remaining: limit - used, resetAt: nextResetMs(nowMs) };
}
export async function authenticateApiKey(d: Deps, raw: string | null, nowMs = Date.now()): Promise<{ user: UserRecord; keyId: string; quota: Quota }> {
  if (!raw) throw new AppError(401, "Falta la clave de API. Envíala en el encabezado x-api-key.");
  if (!raw.startsWith(KEY_PREFIX) || raw.length < 20 || raw.length > 80) throw new AppError(401, "Clave de API inválida.");
  const hash = hashOf(raw);
  const rec = await d.store.get<KeyRecord>(`apikey:${hash}`);
  const user = rec ? await getUser(d, rec.uid) : null;
  if (!rec || !user) throw new AppError(401, "Clave de API inválida o revocada.");
  if (user.status === "suspended") throw new AppError(403, "La cuenta asociada a esta clave está suspendida.");

  const active = await effectivePlan(d, user, nowMs);
  const [keyRateAllowed, userRateAllowed] = await Promise.all([
    rec.minuteLimit === null || rec.minuteLimit === undefined
      ? Promise.resolve(true)
      : hit(d.store, `rl:key:${hash}`, rec.minuteLimit, 60),
    hit(d.store, `rl:api:${user.uid}`, user.minuteLimit ?? active.config.perMinute, 60),
  ]);
  if (!keyRateAllowed || !userRateAllowed) throw new AppError(429, "Demasiadas solicitudes por minuto. Espera unos segundos.");

  const stamp = dayStamp(nowMs);
  const userQuotaKey = `quota:${user.uid}:${stamp}`;
  const used = await d.store.incr(userQuotaKey);
  if (used === 1) await d.store.expire(userQuotaKey, 2 * 86_400);
  const userLimit = user.dailyLimit ?? active.config.perDay;
  if (used > userLimit) throw new AppError(429, `Agotaste las ${userLimit} solicitudes de hoy. Se renuevan a las 12 a. m. (hora de Lima).`);

  const keyQuotaKey = `quota:key:${hash}:${stamp}`;
  const keyUsed = await d.store.incr(keyQuotaKey);
  if (keyUsed === 1) await d.store.expire(keyQuotaKey, 2 * 86_400);
  const keyLimit = rec.dailyLimit ?? userLimit;
  if (keyUsed > keyLimit) throw new AppError(429, `Esta clave agotó sus ${keyLimit} solicitudes diarias.`);

  const activityDue = await d.store.set(`activity:api-minute:${user.uid}`, stamp, { ex: 60, nx: true });
  const pruneDue = await d.store.set(`apikey-days:pruned:${rec.id}`, stamp, { ex: 86_400, nx: true });
  const writes: Promise<unknown>[] = [
    recordUsage(d, user.uid, nowMs),
    d.store.hincrby(`apikey-usage:${rec.id}:${stamp}`, "requests", 1),
    d.store.zadd(`apikey-days:${rec.id}`, nowMs, stamp),
  ];
  if (nowMs - rec.lastUsedAt > 60_000) writes.push(d.store.set(`apikey:${hash}`, { ...rec, lastUsedAt: nowMs }));
  if (activityDue) writes.push(recordUserActivity(d, user.uid, "uso_api", `Solicitud API con clave ${rec.prefix}…`));
  if (pruneDue) {
    writes.push((async () => {
      if (await d.store.zcard(`apikey-days:${rec.id}`) <= 30) return;
      const oldDays = await d.store.zrange(`apikey-days:${rec.id}`, 0, -31);
      await Promise.all(oldDays.flatMap((day) => [
        d.store.del(`apikey-usage:${rec.id}:${day}`),
        d.store.zrem(`apikey-days:${rec.id}`, day),
      ]));
    })());
  }
  await Promise.all(writes);

  return { user, keyId: rec.id, quota: { plan: active.id, limit: userLimit, used, remaining: userLimit - used, resetAt: nextResetMs(nowMs) } };
}
export async function setUserPlan(d: Deps, uid: string, plan: unknown, durationDays?: unknown): Promise<void> {
  if (!isPlanId(plan)) throw new AppError(400, "Plan no válido.");
  const config = await getPlanConfig(d, plan);
  if (!config) throw new AppError(400, "El plan seleccionado no existe.");
  if (durationDays !== undefined && (!Number.isInteger(durationDays) || Number(durationDays) < 1 || Number(durationDays) > 3650)) throw new AppError(400, "La duración debe estar entre 1 y 3650 días.");
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Usuario no encontrado.");
  await d.store.set(`user:${uid}`, { ...user, plan, planExpiresAt: durationDays ? Date.now() + Number(durationDays) * 86_400_000 : null });
  await recordUserActivity(d, uid, "plan_asignado", `Plan ${config.label}${durationDays ? ` durante ${durationDays} días` : " permanente"}`);
}
