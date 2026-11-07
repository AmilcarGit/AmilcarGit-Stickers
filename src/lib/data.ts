import { api } from "./api";
import type { MeInfo, UserRow } from "./types";
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

export async function saveProfile(patch: { displayName: string }): Promise<MeInfo> {
  return (await api<{ me: MeInfo }>("/api/me/profile", { method: "PATCH", body: patch })).me;
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


export type AdminActivity = { at: number; type: string; detail: string };
export type AdminUserDetail = { user: UserRow; activity: AdminActivity[]; canManageRoles: boolean };

export async function getAdminUser(uid: string): Promise<AdminUserDetail> {
  return api(`/api/admin/users/${encodeURIComponent(uid)}`);
}

export async function updateAdminUser(uid: string, patch: { status?: "active" | "suspended"; dailyLimit?: number | null; minuteLimit?: number | null; role?: "user" | "moderator"; displayName?: string }): Promise<UserRow> {
  const result = await api<{ user: UserRow }>(`/api/admin/users/${encodeURIComponent(uid)}`, { method: "PATCH", body: patch });
  return result.user;
}


export type AdminAuditEntry = { at: number; actor: string; target: string; action: string; detail: string };
export async function getAdminAudit(): Promise<AdminAuditEntry[]> {
  return (await api<{ actions: AdminAuditEntry[] }>("/api/admin/audit")).actions;
}
