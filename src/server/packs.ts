import { LICENSES, type LicenseId } from "@/lib/credits";
import { CATEGORIES, type Category, type Pack, type PackSticker } from "@/lib/types";
import { validatePack } from "@/lib/whatsapp";
import { isOwnBlobUrl } from "./blob-url";
import type { Deps } from "./deps";
import { AppError } from "./errors";
import { hit } from "./store";
import { newId } from "./tokens";
import { adjustCounts, type UserRecord } from "./users";

type PackRecord = Omit<Pack, "favCount" | "downloadCount">;

const FAV = "packs:fav";
const DL = "packs:dl";
const MAX_PACKS_PER_USER = 50;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function toPack(rec: PackRecord, fav: number, dl: number): Pack {
  return { ...rec, favCount: Math.max(0, fav), downloadCount: Math.max(0, dl) };
}

type EditableFields = Pick<PackRecord, "title" | "description" | "category" | "tags" | "visibility" | "license" | "originality" | "thirdPartyNote">;

/** Valida y normaliza los campos editables de un paquete (al publicar y al editar). */
function readFields(raw: Record<string, unknown>, base?: EditableFields): EditableFields {
  const title = raw.title === undefined && base ? base.title : text(raw.title, 60);
  if (title.length < 1) throw new AppError(400, "El paquete necesita un nombre (máximo 60 caracteres).");

  const category = (raw.category === undefined && base ? base.category : raw.category) as Category;
  if (!CATEGORIES.includes(category)) throw new AppError(400, "Categoría no válida.");

  const visibilityRaw = raw.visibility === undefined && base ? base.visibility : raw.visibility;
  if (visibilityRaw !== "public" && visibilityRaw !== "private") throw new AppError(400, "Visibilidad no válida.");
  const visibility: "public" | "private" = visibilityRaw;

  const license = (raw.license === undefined && base ? base.license : raw.license) as LicenseId;
  if (typeof license !== "string" || !(license in LICENSES)) throw new AppError(400, "Licencia no válida.");

  const originalityRaw = raw.originality === undefined && base ? base.originality : raw.originality;
  if (originalityRaw !== "original" && originalityRaw !== "third-party") throw new AppError(400, "Indica si el contenido es original o de terceros.");
  const originality: "original" | "third-party" = originalityRaw;

  const tagsRaw = raw.tags === undefined && base ? base.tags : raw.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase().slice(0, 30))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    title,
    description: raw.description === undefined && base ? base.description : text(raw.description, 500),
    category,
    tags,
    visibility,
    license,
    originality,
    thirdPartyNote: originality === "third-party" ? (raw.thirdPartyNote === undefined && base ? base.thirdPartyNote : text(raw.thirdPartyNote, 500)) : "",
  };
}

async function setPublicIndex(d: Deps, rec: PackRecord): Promise<void> {
  if (rec.listed) await d.store.zadd("packs:public", rec.createdAt, rec.id);
  else await d.store.zrem("packs:public", rec.id);
}

export async function publishPack(d: Deps, user: UserRecord, raw: Record<string, unknown>): Promise<Pack> {
  if (!user.emailVerified) throw new AppError(403, "Verifica tu correo electrónico antes de publicar.");
  if (!(await hit(d.store, `rl:publish:${user.uid}`, 20, 3600))) throw new AppError(429, "Publicaste muchos paquetes seguidos. Espera un rato.");
  if ((await d.store.zcard(`packs:owner:${user.uid}`)) >= MAX_PACKS_PER_USER) {
    throw new AppError(403, `Llegaste al máximo de ${MAX_PACKS_PER_USER} paquetes.`);
  }

  const fields = readFields(raw);
  const animated = raw.animated === true;
  const trayUrl = raw.trayUrl;
  if (!isOwnBlobUrl(trayUrl, user.uid, "tray")) throw new AppError(400, "El ícono del paquete no es válido.");
  if (!Array.isArray(raw.stickers)) throw new AppError(400, "Faltan los stickers.");

  const stickers: PackSticker[] = raw.stickers.map((s: unknown) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const url = o.url;
    if (!isOwnBlobUrl(url, user.uid, "sticker")) throw new AppError(400, "Uno de los stickers no es válido.");
    const emojis = Array.isArray(o.emojis) ? o.emojis.filter((e): e is string => typeof e === "string" && e.length > 0 && e.length <= 16) : [];
    return { url, emojis, bytes: typeof o.bytes === "number" ? o.bytes : 0 };
  });

  const issues = validatePack({ stickers: stickers.map((s) => ({ animated, emojis: s.emojis, bytes: s.bytes })) });
  if (issues.length > 0) throw new AppError(400, issues[0].message);

  const rec: PackRecord = {
    id: newId("p"),
    ownerId: user.uid,
    ownerUsername: user.username,
    ownerName: user.displayName,
    ...fields,
    animated,
    listed: fields.visibility === "public",
    status: "active",
    stickers,
    trayUrl,
    createdAt: Date.now(),
  };
  await d.store.set(`pack:${rec.id}`, rec);
  await d.store.zadd(`packs:owner:${user.uid}`, rec.createdAt, rec.id);
  await setPublicIndex(d, rec);
  await adjustCounts(d, user.uid, 1, stickers.length);
  return toPack(rec, 0, 0);
}

export async function getPackFor(d: Deps, id: string, viewer: { uid: string; admin: boolean } | null): Promise<{ pack: Pack; favorited: boolean } | null> {
  const rec = await d.store.get<PackRecord>(`pack:${id}`);
  if (!rec) return null;
  const isOwner = viewer?.uid === rec.ownerId;
  if (rec.status === "removed" && !isOwner && !viewer?.admin) return null;
  const [fav, dl, favorited] = await Promise.all([
    d.store.hget(FAV, id),
    d.store.hget(DL, id),
    viewer ? d.store.sismember(`fav:${viewer.uid}`, id) : Promise.resolve(false),
  ]);
  return { pack: toPack(rec, fav, dl), favorited };
}

async function loadMany(d: Deps, ids: string[]): Promise<Pack[]> {
  if (ids.length === 0) return [];
  const [recs, fav, dl] = await Promise.all([d.store.mget<PackRecord>(ids.map((i) => `pack:${i}`)), d.store.hgetall(FAV), d.store.hgetall(DL)]);
  return recs.filter((r): r is PackRecord => r !== null).map((r) => toPack(r, fav[r.id] ?? 0, dl[r.id] ?? 0));
}

export async function listPublicPacks(d: Deps, max = 200): Promise<Pack[]> {
  return loadMany(d, await d.store.zrange("packs:public", 0, max - 1, true));
}

export async function listPacksByOwner(d: Deps, ownerUid: string, includeUnlisted: boolean): Promise<Pack[]> {
  const packs = await loadMany(d, await d.store.zrange(`packs:owner:${ownerUid}`, 0, 99, true));
  return includeUnlisted ? packs : packs.filter((p) => p.listed);
}

export async function updatePack(d: Deps, user: UserRecord, id: string, raw: Record<string, unknown>): Promise<Pack> {
  const rec = await d.store.get<PackRecord>(`pack:${id}`);
  if (!rec || rec.ownerId !== user.uid) throw new AppError(404, "Paquete no encontrado.");
  const fields = readFields(raw, rec);
  const next: PackRecord = { ...rec, ...fields, listed: fields.visibility === "public" && rec.status === "active" };
  await d.store.set(`pack:${id}`, next);
  await setPublicIndex(d, next);
  const [fav, dl] = await Promise.all([d.store.hget(FAV, id), d.store.hget(DL, id)]);
  return toPack(next, fav, dl);
}

/** Borra el paquete y devuelve las URLs de sus archivos para que la ruta los elimine del Blob. */
export async function deletePack(d: Deps, actor: { uid: string; admin: boolean }, id: string): Promise<string[]> {
  const rec = await d.store.get<PackRecord>(`pack:${id}`);
  if (!rec || (rec.ownerId !== actor.uid && !actor.admin)) throw new AppError(404, "Paquete no encontrado.");
  await d.store.del(`pack:${id}`);
  await d.store.zrem("packs:public", id);
  await d.store.zrem(`packs:owner:${rec.ownerId}`, id);
  await adjustCounts(d, rec.ownerId, -1, -rec.stickers.length);
  return [rec.trayUrl, ...rec.stickers.map((s) => s.url)];
}

export async function setFavorite(d: Deps, uid: string, id: string, on: boolean): Promise<{ favCount: number }> {
  const rec = await d.store.get<PackRecord>(`pack:${id}`);
  if (!rec || rec.status === "removed") throw new AppError(404, "Paquete no encontrado.");
  const has = await d.store.sismember(`fav:${uid}`, id);
  if (on && !has) {
    await d.store.sadd(`fav:${uid}`, id);
    await d.store.hincrby(FAV, id, 1);
  } else if (!on && has) {
    await d.store.srem(`fav:${uid}`, id);
    await d.store.hincrby(FAV, id, -1);
  }
  return { favCount: Math.max(0, await d.store.hget(FAV, id)) };
}

export async function listFavoriteIds(d: Deps, uid: string): Promise<string[]> {
  return d.store.smembers(`fav:${uid}`);
}

export async function registerDownload(d: Deps, id: string, ip: string): Promise<void> {
  if (!(await d.store.get(`pack:${id}`))) return;
  // Máximo 3 descargas contadas por conexión y paquete cada hora, para que no se infle el contador.
  if (await hit(d.store, `rl:dl:${ip}:${id}`, 3, 3600)) await d.store.hincrby(DL, id, 1);
}

/** Moderación: oculta el paquete (no lo borra), así se puede revisar o revertir. */
export async function removeForModeration(d: Deps, id: string): Promise<void> {
  const rec = await d.store.get<PackRecord>(`pack:${id}`);
  if (!rec) return;
  const next: PackRecord = { ...rec, status: "removed", listed: false };
  await d.store.set(`pack:${id}`, next);
  await d.store.zrem("packs:public", id);
}
