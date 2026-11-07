import { api } from "./api";
import type { MeInfo, RankingEntry, UserRow } from "./types";
import { normalizeUsername } from "./validators";

/* ------------------------------ Cuenta ------------------------------ */

export async function fetchMyStats(): Promise<{ requestsThisMonth: number }> {
  return api("/api/me/stats");
}

export async function fetchMe(): Promise<MeInfo | null> {
  return (await api<{ me: MeInfo | null }>("/api/auth/me")).me;
}

export async function usernameAvailable(raw: string): Promise<boolean> {
  const name = encodeURIComponent(normalizeUsername(raw));
  return (await api<{ available: boolean }>(`/api/username?name=${name}`)).available;
}

export async function registerUser(input: { email: string; password: string; username: string; displayName: string; referralCode?: string }): Promise<{ me: MeInfo; emailSent: boolean }> {
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

export async function saveProfile(patch: { displayName?: string; bio?: string; location?: string; showInRanking?: boolean }): Promise<MeInfo> {
  return (await api<{ me: MeInfo }>("/api/me/profile", { method: "PATCH", body: patch })).me;
}

export async function listUsers(offset: number): Promise<{ total: number; users: UserRow[] }> {
  return api(`/api/admin/users?offset=${offset}&limit=50`);
}

/* ------------------------------ Claves de API ------------------------------ */

export type ApiKeyInfo = { id: string; name: string; prefix: string; createdAt: number; lastUsedAt: number; dailyLimit: number | null; minuteLimit: number | null };
export type ApiQuota = { plan: string; limit: number; used: number; remaining: number; resetAt: number };

export async function listApiKeys(): Promise<{ keys: ApiKeyInfo[]; quota: ApiQuota }> {
  return api("/api/keys");
}

export async function createApiKey(name: string): Promise<{ key: string; info: ApiKeyInfo }> {
  return api("/api/keys", { method: "POST", body: { name } });
}

export async function revokeApiKey(id: string): Promise<void> {
  await api(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function setUserPlan(uid: string, plan: string, durationDays?: number): Promise<void> {
  await api(`/api/admin/users/${encodeURIComponent(uid)}/plan`, { method: "POST", body: { plan, durationDays } });
}


export type AdminActivity = { at: number; type: string; detail: string };
export type AdminUserDetail = { user: UserRow; activity: AdminActivity[]; canManageRoles: boolean };

export async function getAdminUser(uid: string): Promise<AdminUserDetail> {
  return api(`/api/admin/users/${encodeURIComponent(uid)}`);
}

export async function updateAdminUser(uid: string, patch: { status?: "active" | "suspended"; dailyLimit?: number | null; minuteLimit?: number | null; role?: "user" | "moderator"; displayName?: string; verifiedBadge?: "blue" | "gold" | null }): Promise<UserRow> {
  const result = await api<{ user: UserRow }>(`/api/admin/users/${encodeURIComponent(uid)}`, { method: "PATCH", body: patch });
  return result.user;
}


export type AdminAuditEntry = { at: number; actor: string; target: string; action: string; detail: string };
export async function getAdminAudit(): Promise<AdminAuditEntry[]> {
  return (await api<{ actions: AdminAuditEntry[] }>("/api/admin/audit")).actions;
}


export type AdminPlan = { id: string; label: string; perDay: number; perMinute: number };
export type ApiKeyUsage = { day: string; requests: number };
export async function listAdminKeys(uid: string): Promise<ApiKeyInfo[]> {
  return (await api<{ keys: ApiKeyInfo[] }>(`/api/admin/users/${encodeURIComponent(uid)}/keys`)).keys;
}
export async function createAdminKey(uid: string, name: string): Promise<{ key: string; info: ApiKeyInfo }> {
  return api(`/api/admin/users/${encodeURIComponent(uid)}/keys`, { method: "POST", body: { name } });
}
export async function updateAdminKey(uid: string, id: string, patch: { dailyLimit?: number | null; minuteLimit?: number | null }): Promise<ApiKeyInfo> {
  return (await api<{ key: ApiKeyInfo }>(`/api/admin/users/${encodeURIComponent(uid)}/keys/${encodeURIComponent(id)}`, { method: "PATCH", body: patch })).key;
}
export async function revokeAdminKey(uid: string, id: string): Promise<void> {
  await api(`/api/admin/users/${encodeURIComponent(uid)}/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function rotateAdminKey(uid: string, id: string): Promise<{ key: string; info: ApiKeyInfo }> {
  return api(`/api/admin/users/${encodeURIComponent(uid)}/keys/${encodeURIComponent(id)}`, { method: "POST" });
}
export async function getAdminKeyUsage(uid: string, id: string): Promise<ApiKeyUsage[]> {
  return (await api<{ history: ApiKeyUsage[] }>(`/api/admin/users/${encodeURIComponent(uid)}/keys/${encodeURIComponent(id)}`)).history;
}
export async function listAdminPlans(): Promise<AdminPlan[]> {
  return (await api<{ plans: AdminPlan[] }>("/api/admin/plans")).plans;
}
export async function saveAdminPlan(plan: { id?: string; label: string; perDay: number; perMinute: number }): Promise<AdminPlan> {
  return (await api<{ plan: AdminPlan }>("/api/admin/plans", { method: "POST", body: plan })).plan;
}
export async function deleteAdminPlan(id: string): Promise<void> {
  await api(`/api/admin/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ------------------------- Foto de perfil y ranking ------------------------- */

export async function uploadAvatar(file: File): Promise<MeInfo> {
  let res: Response;
  try {
    res = await fetch("/api/me/avatar", { method: "POST", headers: { "content-type": file.type || "application/octet-stream" }, body: file, cache: "no-store" });
  } catch {
    throw new Error("No hay conexión con el servidor. Revisa tu internet.");
  }
  const data = (await res.json().catch(() => null)) as { me?: MeInfo; error?: string } | null;
  if (!res.ok || !data?.me) throw new Error(data?.error ?? "No se pudo subir la foto.");
  return data.me;
}

export async function deleteAvatar(): Promise<MeInfo> {
  return (await api<{ me: MeInfo }>("/api/me/avatar", { method: "DELETE" })).me;
}

export async function fetchRanking(): Promise<{ month: string; entries: RankingEntry[] }> {
  return api("/api/ranking");
}


/* ------------------------- Puntos y recompensas ------------------------- */

export type RewardsData = {
  points: number;
  referrals: number;
  referralCode: string | null;
  referralUrl: string | null;
  daily: { claimed: boolean; streak: number; nextPoints: number };
  badges: { id: string; label: string; description: string; unlocked: boolean }[];
  history: { at: number; amount: number; reason: string; balance?: number }[];
  leaderboard: { rank: number; username: string; displayName: string; verifiedBadge?: "blue" | "gold" | null; points: number }[];
};

export async function fetchRewards(): Promise<RewardsData> {
  return api("/api/rewards");
}

export async function claimDailyReward(): Promise<{ bonus: { points: number; streak: number; balance: number }; rewards: RewardsData }> {
  return api("/api/rewards/daily", { method: "POST" });
}

export async function giftUserPlan(uid: string, plan: "pro" | "ultra", days: number): Promise<{ plan: string; planExpiresAt: number }> {
  return api(`/api/admin/users/${encodeURIComponent(uid)}/gift`, { method: "POST", body: { plan, days } });
}
