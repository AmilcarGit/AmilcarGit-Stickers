import { LICENSES, type LicenseId } from "@/lib/credits";
import { parseScene } from "@/lib/scene";
import type { ProjectDoc, ProjectSummary } from "@/lib/types";
import type { Deps } from "./deps";
import { AppError } from "./errors";
import { newId } from "./tokens";

/** Tope por proyecto: la solicitud REST de Upstash admite alrededor de 1 MB. */
export const MAX_PROJECT_BYTES = 700_000;
export const MAX_PROJECTS_PER_USER = 30;

type ProjectRecord = ProjectDoc;

export async function listProjects(d: Deps, uid: string): Promise<ProjectSummary[]> {
  const ids = await d.store.zrange(`projects:${uid}`, 0, MAX_PROJECTS_PER_USER - 1, true);
  const recs = await d.store.mget<ProjectRecord>(ids.map((id) => `project:${id}`));
  return recs
    .filter((r): r is ProjectRecord => r !== null && r.ownerId === uid)
    .map((r) => ({ id: r.id, name: r.name, thumb: r.thumb, updatedAt: r.updatedAt }));
}

export async function getProject(d: Deps, uid: string, id: string): Promise<ProjectDoc | null> {
  const rec = await d.store.get<ProjectRecord>(`project:${id}`);
  return rec && rec.ownerId === uid ? rec : null;
}

export async function saveProject(d: Deps, uid: string, id: string | null, raw: Record<string, unknown>): Promise<string> {
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 80) : "";
  if (!name) throw new AppError(400, "El proyecto necesita un nombre.");
  const sceneJson = raw.sceneJson;
  if (typeof sceneJson !== "string" || !parseScene(sceneJson)) throw new AppError(400, "El contenido del proyecto no es válido.");
  const thumb = typeof raw.thumb === "string" ? raw.thumb : "";
  if (thumb && (!thumb.startsWith("data:image/") || thumb.length > 60_000)) throw new AppError(400, "La miniatura no es válida.");
  if (sceneJson.length + thumb.length > MAX_PROJECT_BYTES) {
    throw new AppError(413, "El proyecto es demasiado grande para guardarlo. Usa menos imágenes o más pequeñas.");
  }
  const license = (typeof raw.license === "string" && raw.license in LICENSES ? raw.license : "all-rights-reserved") as LicenseId;
  const originality = raw.originality === "third-party" ? "third-party" : "original";
  const thirdPartyNote = typeof raw.thirdPartyNote === "string" ? raw.thirdPartyNote.slice(0, 500) : "";
  const now = Date.now();

  if (id) {
    const current = await getProject(d, uid, id);
    if (!current) throw new AppError(404, "Proyecto no encontrado.");
    await d.store.set(`project:${id}`, { ...current, name, thumb, sceneJson, license, originality, thirdPartyNote, updatedAt: now });
    await d.store.zadd(`projects:${uid}`, now, id);
    return id;
  }

  if ((await d.store.zcard(`projects:${uid}`)) >= MAX_PROJECTS_PER_USER) {
    throw new AppError(403, `Llegaste al máximo de ${MAX_PROJECTS_PER_USER} proyectos. Elimina alguno para crear otro.`);
  }
  const newProject: ProjectRecord = { id: newId("pr"), ownerId: uid, name, thumb, sceneJson, license, originality, thirdPartyNote, createdAt: now, updatedAt: now };
  await d.store.set(`project:${newProject.id}`, newProject);
  await d.store.zadd(`projects:${uid}`, now, newProject.id);
  return newProject.id;
}

export async function deleteProject(d: Deps, uid: string, id: string): Promise<void> {
  const current = await getProject(d, uid, id);
  if (!current) throw new AppError(404, "Proyecto no encontrado.");
  await d.store.del(`project:${id}`);
  await d.store.zrem(`projects:${uid}`, id);
}
