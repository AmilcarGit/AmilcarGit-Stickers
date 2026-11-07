import sharp from "sharp";
import type { RankingEntry } from "@/lib/types";
import type { Deps } from "./deps";
import { AppError } from "./errors";
import { getUser, type UserRecord } from "./users";
import { normalizeUsername } from "@/lib/validators";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_SIZE = 256;
const RANKING_SIZE = 10;

/* ------------------------------- Foto de perfil ------------------------------- */

/** Recorta al centro a 256x256 y la guarda como WebP (pesa pocos KB) en Redis. */
export async function setAvatar(d: Deps, uid: string, input: Uint8Array, nowMs = Date.now()): Promise<UserRecord> {
  if (input.length === 0) throw new AppError(400, "No se recibió ninguna imagen.");
  if (input.length > MAX_AVATAR_BYTES) throw new AppError(413, "La foto pesa más de 2 MB.");
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Cuenta no encontrada.");
  let out: Buffer;
  try {
    const img = sharp(input, { limitInputPixels: 40_000_000 });
    const meta = await img.metadata();
    if (!meta.format || !["png", "jpeg", "webp", "gif"].includes(meta.format)) throw new Error("formato");
    out = await img.rotate().resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
  } catch {
    throw new AppError(400, "La foto no es una imagen válida (usa PNG, JPG, WebP o GIF).");
  }
  await d.store.set(`avatar:${uid}`, out.toString("base64"));
  const next = { ...user, avatarV: nowMs };
  await d.store.set(`user:${uid}`, next);
  return next;
}

export async function removeAvatar(d: Deps, uid: string): Promise<UserRecord> {
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Cuenta no encontrada.");
  await d.store.del(`avatar:${uid}`);
  const next = { ...user, avatarV: 0 };
  await d.store.set(`user:${uid}`, next);
  return next;
}

/** Foto pública de un usuario por su nombre de usuario (null si no tiene). */
export async function avatarByUsername(d: Deps, username: string): Promise<Uint8Array | null> {
  const uid = await d.store.get<string>(`uname:${normalizeUsername(username)}`);
  if (!uid) return null;
  const b64 = await d.store.get<string>(`avatar:${uid}`);
  return b64 ? new Uint8Array(Buffer.from(b64, "base64")) : null;
}

export async function setRankingVisibility(d: Deps, uid: string, show: boolean): Promise<UserRecord> {
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Cuenta no encontrada.");
  const next = { ...user, showInRanking: show };
  await d.store.set(`user:${uid}`, next);
  return next;
}

/* ---------------------------------- Ranking ---------------------------------- */

/** AAAAMM en hora de Lima (UTC-5). */
export const monthStamp = (nowMs: number): string => new Date(nowMs - 5 * 3600 * 1000).toISOString().slice(0, 7).replace("-", "");

/** Suma una solicitud exitosa al contador del mes (hora de Lima). */
export async function recordUsage(d: Deps, uid: string, nowMs = Date.now()): Promise<void> {
  const key = `usage:${monthStamp(nowMs)}`;
  const n = await d.store.hincrby(key, uid, 1);
  if (n === 1) await d.store.expire(key, 70 * 86_400);
}

/** Los que más usan la API este mes. Excluye a quien pidió no aparecer y nunca expone correo ni uid. */
export async function monthlyRanking(d: Deps, nowMs = Date.now(), size = RANKING_SIZE): Promise<{ month: string; entries: RankingEntry[] }> {
  const month = monthStamp(nowMs);
  const all = await d.store.hgetall(`usage:${month}`);
  const sorted = Object.entries(all)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, size * 3 + 20);
  const records = await d.store.mget<UserRecord>(sorted.map(([uid]) => `user:${uid}`));
  const entries: RankingEntry[] = [];
  sorted.forEach(([, count], i) => {
    const u = records[i];
    if (!u || u.showInRanking === false || entries.length >= size) return;
    entries.push({ rank: entries.length + 1, username: u.username, displayName: u.displayName, count, avatarV: u.avatarV ?? 0 });
  });
  return { month: `${month.slice(0, 4)}-${month.slice(4)}`, entries };
}
