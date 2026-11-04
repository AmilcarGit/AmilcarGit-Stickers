import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { normalizeUsername } from "./validators";
import type { Pack, ProjectDoc, ProjectSummary, Report, ReportReason, UserProfile } from "./types";

/* ------------------------------ Usuarios ------------------------------ */

export async function usernameAvailable(raw: string): Promise<boolean> {
  const snap = await getDoc(doc(db(), "usernames", normalizeUsername(raw)));
  return !snap.exists();
}

export async function registerUser(input: {
  email: string;
  password: string;
  username: string;
  displayName: string;
}): Promise<void> {
  const username = normalizeUsername(input.username);
  if (!(await usernameAvailable(username))) throw new Error("Ese nombre de usuario ya está en uso.");

  const cred = await createUserWithEmailAndPassword(auth(), input.email.trim(), input.password);
  try {
    const displayName = input.displayName.trim() || username;
    await updateAuthProfile(cred.user, { displayName });
    const batch = writeBatch(db());
    batch.set(doc(db(), "users", cred.user.uid), {
      username,
      displayName,
      bio: "",
      photoURL: "",
      profilePublic: true,
      createdAt: Date.now(),
      stickerCount: 0,
      packCount: 0,
    });
    batch.set(doc(db(), "usernames", username), { uid: cred.user.uid });
    await batch.commit();
  } catch {
    // Si el perfil no se pudo crear (por ejemplo, alguien tomó el usuario justo antes),
    // se elimina la cuenta recién creada para no dejarla a medias.
    await cred.user.delete().catch(() => undefined);
    throw new Error("No se pudo crear el perfil. Prueba con otro usuario.");
  }
  await sendEmailVerification(cred.user);
}

function toProfile(uid: string, d: Record<string, unknown>): UserProfile {
  return {
    uid,
    username: String(d.username ?? ""),
    displayName: String(d.displayName ?? ""),
    bio: String(d.bio ?? ""),
    photoURL: String(d.photoURL ?? ""),
    profilePublic: d.profilePublic !== false,
    createdAt: Number(d.createdAt ?? 0),
    stickerCount: Number(d.stickerCount ?? 0),
    packCount: Number(d.packCount ?? 0),
  };
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db(), "users", uid));
  return snap.exists() ? toProfile(uid, snap.data()) : null;
}

export async function getProfileByUsername(raw: string): Promise<UserProfile | null> {
  const name = await getDoc(doc(db(), "usernames", normalizeUsername(raw)));
  if (!name.exists()) return null;
  return getProfile(String(name.data().uid));
}

export async function saveProfile(
  uid: string,
  patch: Partial<Pick<UserProfile, "displayName" | "bio" | "photoURL" | "profilePublic">>,
): Promise<void> {
  await updateDoc(doc(db(), "users", uid), patch);
}

export async function isAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db(), "admins", uid));
    return snap.exists();
  } catch {
    return false;
  }
}

/* ------------------------------ Proyectos ------------------------------ */

export const MAX_PROJECT_BYTES = 900_000;

export async function listMyProjects(uid: string): Promise<ProjectSummary[]> {
  const snap = await getDocs(query(collection(db(), "projects"), where("ownerId", "==", uid), limit(100)));
  return snap.docs
    .map((d) => ({
      id: d.id,
      name: String(d.data().name ?? "Sin título"),
      thumb: String(d.data().thumb ?? ""),
      updatedAt: Number(d.data().updatedAt ?? 0),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectDoc | null> {
  const snap = await getDoc(doc(db(), "projects", id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    ownerId: String(d.ownerId),
    name: String(d.name ?? ""),
    thumb: String(d.thumb ?? ""),
    sceneJson: String(d.sceneJson ?? ""),
    originality: d.originality === "third-party" ? "third-party" : "original",
    license: (d.license ?? "all-rights-reserved") as ProjectDoc["license"],
    thirdPartyNote: String(d.thirdPartyNote ?? ""),
    createdAt: Number(d.createdAt ?? 0),
    updatedAt: Number(d.updatedAt ?? 0),
  };
}

export async function saveProject(
  uid: string,
  id: string | null,
  data: Omit<ProjectDoc, "id" | "ownerId" | "createdAt" | "updatedAt">,
): Promise<string> {
  const size = new Blob([data.sceneJson]).size + data.thumb.length;
  if (size > MAX_PROJECT_BYTES) {
    throw new Error("El proyecto es demasiado grande para guardarlo. Usa menos imágenes o más pequeñas.");
  }
  const now = Date.now();
  if (id) {
    await updateDoc(doc(db(), "projects", id), { ...data, updatedAt: now });
    return id;
  }
  const ref = await addDoc(collection(db(), "projects"), { ...data, ownerId: uid, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db(), "projects", id));
}

/* ------------------------------ Paquetes ------------------------------ */

function toPack(id: string, d: Record<string, unknown>): Pack {
  return {
    id,
    ownerId: String(d.ownerId),
    ownerUsername: String(d.ownerUsername ?? ""),
    ownerName: String(d.ownerName ?? ""),
    title: String(d.title ?? ""),
    description: String(d.description ?? ""),
    category: (d.category ?? "Otros") as Pack["category"],
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    animated: d.animated === true,
    visibility: d.visibility === "private" ? "private" : "public",
    listed: d.listed === true,
    status: d.status === "removed" ? "removed" : "active",
    license: (d.license ?? "all-rights-reserved") as Pack["license"],
    originality: d.originality === "third-party" ? "third-party" : "original",
    thirdPartyNote: String(d.thirdPartyNote ?? ""),
    stickers: Array.isArray(d.stickers) ? (d.stickers as Pack["stickers"]) : [],
    trayUrl: String(d.trayUrl ?? ""),
    createdAt: Number(d.createdAt ?? 0),
    favCount: Number(d.favCount ?? 0),
    downloadCount: Number(d.downloadCount ?? 0),
  };
}

/** Paquetes públicos. Se ordena en el cliente para no exigir índices compuestos en Firestore. */
export async function listPublicPacks(max = 200): Promise<Pack[]> {
  const snap = await getDocs(query(collection(db(), "packs"), where("listed", "==", true), limit(max)));
  return snap.docs.map((d) => toPack(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
}

export async function listPacksByOwner(uid: string, onlyListed: boolean): Promise<Pack[]> {
  const q = onlyListed
    ? query(collection(db(), "packs"), where("ownerId", "==", uid), where("listed", "==", true), limit(100))
    : query(collection(db(), "packs"), where("ownerId", "==", uid), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toPack(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPack(id: string): Promise<Pack | null> {
  const snap = await getDoc(doc(db(), "packs", id));
  return snap.exists() ? toPack(snap.id, snap.data()) : null;
}

export type NewPack = Omit<Pack, "id" | "listed" | "status" | "favCount" | "downloadCount" | "createdAt">;

export async function publishPack(input: NewPack): Promise<string> {
  const ref = doc(collection(db(), "packs"));
  const batch = writeBatch(db());
  batch.set(ref, {
    ...input,
    listed: input.visibility === "public",
    status: "active",
    favCount: 0,
    downloadCount: 0,
    createdAt: Date.now(),
  });
  batch.update(doc(db(), "users", input.ownerId), {
    packCount: increment(1),
    stickerCount: increment(input.stickers.length),
  });
  await batch.commit();
  return ref.id;
}

export async function updatePackInfo(
  id: string,
  patch: Partial<Pick<Pack, "title" | "description" | "category" | "tags" | "visibility" | "license" | "originality" | "thirdPartyNote">> & {
    listed?: boolean;
  },
): Promise<void> {
  await updateDoc(doc(db(), "packs", id), patch);
}

export async function deletePack(pack: Pack): Promise<void> {
  const batch = writeBatch(db());
  batch.delete(doc(db(), "packs", pack.id));
  batch.update(doc(db(), "users", pack.ownerId), {
    packCount: increment(-1),
    stickerCount: increment(-pack.stickers.length),
  });
  await batch.commit();
}

export async function registerDownload(packId: string): Promise<void> {
  try {
    await updateDoc(doc(db(), "packs", packId), { downloadCount: increment(1) });
  } catch {
    // El contador es opcional (por ejemplo, sin sesión iniciada): no debe romper la descarga.
  }
}

/* ------------------------------ Favoritos ------------------------------ */

export async function isFavorite(uid: string, packId: string): Promise<boolean> {
  const snap = await getDoc(doc(db(), "favorites", `${uid}_${packId}`));
  return snap.exists();
}

export async function listFavoriteIds(uid: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db(), "favorites"), where("uid", "==", uid), limit(200)));
  return snap.docs.map((d) => String(d.data().packId));
}

export async function setFavorite(uid: string, packId: string, on: boolean): Promise<void> {
  const batch = writeBatch(db());
  const ref = doc(db(), "favorites", `${uid}_${packId}`);
  if (on) batch.set(ref, { uid, packId, createdAt: Date.now() });
  else batch.delete(ref);
  batch.update(doc(db(), "packs", packId), { favCount: increment(on ? 1 : -1) });
  await batch.commit();
}

/* ------------------------------ Reportes y moderación ------------------------------ */

export async function createReport(input: {
  packId: string;
  packTitle: string;
  reporterId: string;
  reason: ReportReason;
  details: string;
}): Promise<void> {
  await addDoc(collection(db(), "reports"), {
    ...input,
    details: input.details.slice(0, 1000),
    status: "open",
    createdAt: Date.now(),
  });
}

export async function listOpenReports(): Promise<Report[]> {
  const snap = await getDocs(query(collection(db(), "reports"), where("status", "==", "open"), limit(100)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Report, "id">) }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Tras revisar: retira el paquete (deja de ser público) o descarta el reporte. */
export async function resolveReport(report: Report, action: "removed" | "dismissed"): Promise<void> {
  const batch = writeBatch(db());
  if (action === "removed") {
    batch.update(doc(db(), "packs", report.packId), { status: "removed", listed: false });
  }
  batch.update(doc(db(), "reports", report.id), { status: action });
  await batch.commit();
}

