import { api } from "./api";
import type { MeInfo, Pack, ProjectDoc, ProjectSummary, Report, UserProfile, UserRow } from "./types";
import { normalizeUsername } from "./validators";

/* ------------------------------ Cuenta ------------------------------ */

export async function fetchMe(): Promise<MeInfo | null> {
  return (await api<{ me: MeInfo | null }>("/api/auth/me")).me;
}

export async function usernameAvailable(raw: string): Promise<boolean> {
  const name = encodeURIComponent(normalizeUsername(raw));
  return (await api<{ available: boolean }>(`/api/username?name=${name}`)).available;
}

export async function registerUser(input: { email: string; password: string; username: string; displayName: string }): Promise<{ me: MeInfo; emailSent: boolean }> {
  return api("/api/auth/register", { method: "POST", body: input });
}

export async function loginUser(input: { email: string; password: string }): Promise<MeInfo> {
  return (await api<{ me: MeInfo }>("/api/auth/login", { method: "POST", body: input })).me;
}

export async function logoutUser(): Promise<void> {
  await api("/api/auth/logout", { method: "POST" });
}

export async function verifyEmailToken(token: string): Promise<void> {
  await api("/api/auth/verify", { method: "POST", body: { token } });
}

export async function resendVerification(): Promise<void> {
  await api("/api/auth/resend", { method: "POST" });
}

export async function forgotPassword(email: string): Promise<void> {
  await api("/api/auth/forgot", { method: "POST", body: { email } });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api("/api/auth/reset", { method: "POST", body: { token, password } });
}

export async function saveProfile(patch: Partial<Pick<UserProfile, "displayName" | "bio" | "photoURL" | "profilePublic">>): Promise<MeInfo> {
  return (await api<{ me: MeInfo }>("/api/me/profile", { method: "PATCH", body: patch })).me;
}

export async function getUserPage(username: string): Promise<{ profile: UserProfile; packs: Pack[] } | null> {
  try {
    return await api(`/api/users/${encodeURIComponent(normalizeUsername(username))}`);
  } catch (err) {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) return null;
    throw err;
  }
}

/* ------------------------------ Proyectos ------------------------------ */

export async function listMyProjects(): Promise<ProjectSummary[]> {
  return (await api<{ projects: ProjectSummary[] }>("/api/projects")).projects;
}

export async function getProject(id: string): Promise<ProjectDoc | null> {
  try {
    return (await api<{ project: ProjectDoc }>(`/api/projects/${encodeURIComponent(id)}`)).project;
  } catch (err) {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) return null;
    throw err;
  }
}

export async function saveProject(id: string | null, data: Omit<ProjectDoc, "id" | "ownerId" | "createdAt" | "updatedAt">): Promise<string> {
  if (id) {
    await api(`/api/projects/${encodeURIComponent(id)}`, { method: "PUT", body: data });
    return id;
  }
  return (await api<{ id: string }>("/api/projects", { method: "POST", body: data })).id;
}

export async function deleteProject(id: string): Promise<void> {
  await api(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ------------------------------ Paquetes ------------------------------ */

export async function listPublicPacks(): Promise<Pack[]> {
  return (await api<{ packs: Pack[] }>("/api/packs")).packs;
}

export async function listMyPacks(): Promise<Pack[]> {
  return (await api<{ packs: Pack[] }>("/api/me/packs")).packs;
}

export async function listMyFavorites(): Promise<Pack[]> {
  return (await api<{ packs: Pack[] }>("/api/me/favorites")).packs;
}

export async function getPack(id: string): Promise<{ pack: Pack; favorited: boolean } | null> {
  try {
    return await api(`/api/packs/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) return null;
    throw err;
  }
}

export type NewPack = Pick<Pack, "title" | "description" | "category" | "tags" | "visibility" | "license" | "originality" | "thirdPartyNote" | "animated" | "stickers" | "trayUrl">;

export async function publishPack(input: NewPack): Promise<Pack> {
  return (await api<{ pack: Pack }>("/api/packs", { method: "POST", body: input })).pack;
}

export async function updatePackInfo(
  id: string,
  patch: Partial<Pick<Pack, "title" | "description" | "category" | "tags" | "visibility" | "license" | "originality" | "thirdPartyNote">>,
): Promise<Pack> {
  return (await api<{ pack: Pack }>(`/api/packs/${encodeURIComponent(id)}`, { method: "PATCH", body: patch })).pack;
}

export async function deletePack(id: string): Promise<void> {
  await api(`/api/packs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function registerDownload(id: string): Promise<void> {
  try {
    await api(`/api/packs/${encodeURIComponent(id)}/download`, { method: "POST" });
  } catch {
    // El contador es opcional: no debe romper la descarga.
  }
}

export async function setFavorite(id: string, on: boolean): Promise<number> {
  return (await api<{ favCount: number }>(`/api/packs/${encodeURIComponent(id)}/favorite`, { method: "POST", body: { on } })).favCount;
}

/* ------------------------------ Reportes y moderación ------------------------------ */

export async function createReport(input: { packId: string; reason: string; details: string }): Promise<void> {
  await api("/api/reports", { method: "POST", body: input });
}

export async function listOpenReports(): Promise<Report[]> {
  return (await api<{ reports: Report[] }>("/api/admin/reports")).reports;
}

export async function resolveReport(id: string, action: "removed" | "dismissed"): Promise<void> {
  await api(`/api/admin/reports/${encodeURIComponent(id)}`, { method: "POST", body: { action } });
}

export async function listUsers(offset: number): Promise<{ total: number; users: UserRow[] }> {
  return api(`/api/admin/users?offset=${offset}&limit=50`);
}

/* ------------------------------ Claves de API ------------------------------ */

export type ApiKeyInfo = { id: string; name: string; prefix: string; createdAt: number; lastUsedAt: number };
export type ApiQuota = { plan: "free" | "pro" | "ultra"; limit: number; used: number; remaining: number; resetAt: number };

export async function listApiKeys(): Promise<{ keys: ApiKeyInfo[]; quota: ApiQuota }> {
  return api("/api/keys");
}

export async function createApiKey(name: string): Promise<{ key: string; info: ApiKeyInfo }> {
  return api("/api/keys", { method: "POST", body: { name } });
}

export async function revokeApiKey(id: string): Promise<void> {
  await api(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function setUserPlan(uid: string, plan: "free" | "pro" | "ultra"): Promise<void> {
  await api(`/api/admin/users/${encodeURIComponent(uid)}/plan`, { method: "POST", body: { plan } });
}
