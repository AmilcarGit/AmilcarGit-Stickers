import type { AdminBadge, MeInfo, UserRow } from "@/lib/types";
import { normalizeUsername, validateEmail, validatePassword, validateUsername } from "@/lib/validators";
import type { Deps } from "./deps";
import { resetMail, verificationMail } from "./emails";
import { AppError, ConfigError } from "./errors";
import { MAX_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./password";
import { revokeAllSessions } from "./session";
import { hit } from "./store";
import { newId, randomToken, sha256 } from "./tokens";
import { completeReferral, prepareReferral } from "./rewards";

export type UserRecord = {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  verifiedBadge?: "blue" | "gold" | null;
  adminBadges?: AdminBadge[];
  createdAt: number;
  passHash: string;
  emailVerified: boolean;
  /** Plan de la API (por defecto «free»). Solo lo cambia un moderador. */
  plan?: string;
  planExpiresAt?: number | null;
  status?: "active" | "suspended";
  dailyLimit?: number | null;
  minuteLimit?: number | null;
  role?: "user" | "moderator";
  /** Versión de la foto de perfil (0 o ausente = sin foto). */
  avatarV?: number;
  /** Aparecer en el ranking público de uso (por defecto sí). */
  showInRanking?: boolean;
  bio?: string;
  location?: string;
  referralCode?: string;
  referredBy?: string;
};

const VERIFY_TTL = 60 * 60 * 24;
const RESET_TTL = 60 * 60;
const lc = (s: string) => s.trim().toLowerCase();

export const isAdmin = (d: Deps, u: UserRecord): boolean => u.emailVerified && (d.adminEmails.includes(u.email) || u.role === "moderator");

export function toMe(d: Deps, u: UserRecord): MeInfo {
  return { uid: u.uid, username: u.username, displayName: u.displayName, verifiedBadge: u.verifiedBadge ?? null, adminBadges: [...(u.adminBadges ?? []), ...(d.adminEmails[0] === u.email ? [{ id: "amilcargit", label: "AmilcarGit", icon: "♛", color: "rainbow" as const, reason: "Creador de YuiAPI", awardedAt: u.createdAt, awardedBy: "system" }] : [])], createdAt: u.createdAt, email: u.email, emailVerified: u.emailVerified, admin: isAdmin(d, u), plan: u.planExpiresAt && u.planExpiresAt <= Date.now() ? "free" : u.plan ?? "free", planExpiresAt: u.planExpiresAt ?? null, avatarV: u.avatarV ?? 0, showInRanking: u.showInRanking !== false, bio: u.bio ?? "", location: u.location ?? "" };
}

export async function getUser(d: Deps, uid: string): Promise<UserRecord | null> {
  return d.store.get<UserRecord>(`user:${uid}`);
}

async function sendVerification(d: Deps, u: UserRecord): Promise<boolean> {
  if (!d.mailer.configured) return false;
  const token = randomToken();
  await d.store.set(`verify:${sha256(token)}`, u.uid, { ex: VERIFY_TTL });
  try {
    await d.mailer.send(verificationMail(u.email, u.displayName, `${d.siteUrl}/verify?token=${token}`));
    return true;
  } catch (err) {
    console.error("No se pudo enviar el correo de verificación:", err instanceof Error ? err.message : "error");
    return false;
  }
}

export async function usernameAvailable(d: Deps, raw: string): Promise<boolean> {
  const name = normalizeUsername(raw);
  if (validateUsername(name)) return false;
  return (await d.store.get(`uname:${name}`)) === null;
}

export async function registerUser(
  d: Deps,
  input: { email: string; password: string; username: string; displayName: string; referralCode?: string },
  ip: string,
): Promise<{ user: UserRecord; emailSent: boolean }> {
  if (!(await hit(d.store, `rl:reg:${ip}`, 10, 3600))) {
    throw new AppError(429, "Demasiados registros desde esta conexión. Inténtalo más tarde.");
  }
  const email = lc(input.email);
  const username = normalizeUsername(input.username);
  const problem = validateEmail(email) ?? validateUsername(username) ?? validatePassword(input.password);
  if (problem) throw new AppError(400, problem);
  if (input.password.length > MAX_PASSWORD_LENGTH) throw new AppError(400, "La contraseña es demasiado larga.");

  const uid = newId("u");
  // Reservas atómicas (SET NX): garantizan usuario y correo únicos aunque haya registros simultáneos.
  if (!(await d.store.set(`uname:${username}`, uid, { nx: true }))) throw new AppError(409, "Ese nombre de usuario ya está en uso.");
  if (!(await d.store.set(`uemail:${email}`, uid, { nx: true }))) {
    await d.store.del(`uname:${username}`);
    throw new AppError(409, "Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.");
  }

  const referral = await prepareReferral(d, uid, input.referralCode);
  const user: UserRecord = {
    uid,
    email,
    username,
    displayName: (input.displayName ?? "").trim().slice(0, 60) || username,
    createdAt: Date.now(),
    passHash: await hashPassword(input.password),
    emailVerified: false,
    referralCode: referral.referralCode,
    ...(referral.referredBy ? { referredBy: referral.referredBy } : {}),
  };
  await d.store.set(`user:${uid}`, user);
  await d.store.zadd("users", user.createdAt, uid);
  return { user, emailSent: await sendVerification(d, user) };
}

let dummyHash: Promise<string> | null = null;

export async function loginUser(d: Deps, input: { email: string; password: string }, ip: string): Promise<UserRecord> {
  const email = lc(input.email);
  const okIp = await hit(d.store, `rl:login:ip:${ip}`, 30, 600);
  const okEmail = await hit(d.store, `rl:login:em:${email}`, 8, 600);
  if (!okIp || !okEmail) throw new AppError(429, "Demasiados intentos. Espera unos minutos e inténtalo otra vez.");

  const uid = await d.store.get<string>(`uemail:${email}`);
  const user = uid ? await getUser(d, uid) : null;
  // Si el correo no existe se verifica contra un hash falso para que el tiempo de respuesta no delate si la cuenta existe.
  dummyHash ??= hashPassword("contraseña-falsa-para-igualar-tiempos");
  const ok = await verifyPassword(input.password.slice(0, MAX_PASSWORD_LENGTH), user?.passHash ?? (await dummyHash));
  if (!user || !ok) throw new AppError(401, "Correo o contraseña incorrectos.");
  if (user.status === "suspended") throw new AppError(403, "Tu cuenta está suspendida. Contacta con soporte.");
  await recordUserActivity(d, user.uid, "inicio_sesion", "Inicio de sesión correcto");
  return user;
}

export async function verifyEmail(d: Deps, token: string): Promise<void> {
  const key = `verify:${sha256(token)}`;
  const uid = await d.store.get<string>(key);
  const user = uid ? await getUser(d, uid) : null;
  if (!user) throw new AppError(400, "El enlace no es válido o ya venció. Pide uno nuevo desde tu panel.");
  const verified = { ...user, emailVerified: true };
  await d.store.set(`user:${user.uid}`, verified);
  await completeReferral(d, verified);
  await d.store.del(key);
}

export async function resendVerification(d: Deps, uid: string): Promise<void> {
  const user = await getUser(d, uid);
  if (!user || user.emailVerified) return;
  if (!d.mailer.configured) throw new ConfigError("El envío de correos no está configurado en el servidor.");
  if (!(await hit(d.store, `rl:resend:${uid}`, 5, 3600))) throw new AppError(429, "Ya pediste varios correos. Espera un rato.");
  if (!(await sendVerification(d, user))) throw new AppError(502, "No se pudo enviar el correo. Inténtalo más tarde.");
}

export async function requestReset(d: Deps, emailRaw: string, ip: string): Promise<void> {
  if (!d.mailer.configured) throw new ConfigError("La recuperación por correo no está disponible: el servidor no tiene correo configurado.");
  const email = lc(emailRaw);
  if (validateEmail(email)) throw new AppError(400, "Escribe un correo electrónico válido.");
  const okIp = await hit(d.store, `rl:reset:ip:${ip}`, 10, 3600);
  const okEmail = await hit(d.store, `rl:reset:em:${email}`, 3, 3600);
  if (!okIp || !okEmail) throw new AppError(429, "Demasiados intentos. Espera un rato.");

  // Siempre se responde igual exista o no la cuenta, para no revelar quién está registrado.
  const uid = await d.store.get<string>(`uemail:${email}`);
  const user = uid ? await getUser(d, uid) : null;
  if (!user) return;
  const token = randomToken();
  await d.store.set(`reset:${sha256(token)}`, user.uid, { ex: RESET_TTL });
  try {
    await d.mailer.send(resetMail(user.email, user.displayName, `${d.siteUrl}/reset/new?token=${token}`));
  } catch (err) {
    console.error("No se pudo enviar el correo de recuperación:", err instanceof Error ? err.message : "error");
  }
}

export async function resetPassword(d: Deps, token: string, password: string): Promise<void> {
  const problem = validatePassword(password);
  if (problem) throw new AppError(400, problem);
  if (password.length > MAX_PASSWORD_LENGTH) throw new AppError(400, "La contraseña es demasiado larga.");
  const key = `reset:${sha256(token)}`;
  const uid = await d.store.get<string>(key);
  const user = uid ? await getUser(d, uid) : null;
  if (!user) throw new AppError(400, "El enlace no es válido o ya venció. Pide uno nuevo.");
  // Abrir el enlace enviado a su correo también demuestra que ese correo es suyo.
  await d.store.set(`user:${user.uid}`, { ...user, passHash: await hashPassword(password), emailVerified: true });
  await d.store.del(key);
  await revokeAllSessions(d, user.uid);
}

export async function saveProfile(d: Deps, uid: string, patch: { displayName?: unknown; bio?: unknown; location?: unknown }): Promise<UserRecord> {
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Cuenta no encontrada.");
  const next = { ...user };
  if (typeof patch.displayName === "string") next.displayName = patch.displayName.trim().slice(0, 60) || user.username;
  if (typeof patch.bio === "string") next.bio = patch.bio.trim().slice(0, 160);
  if (typeof patch.location === "string") next.location = patch.location.trim().slice(0, 60);
  await d.store.set(`user:${uid}`, next);
  return next;
}

/** Registro completo de usuarios (para moderadores), del más reciente al más antiguo. */
export async function listUsers(d: Deps, offset: number, limit: number): Promise<{ total: number; users: UserRow[] }> {
  const [total, ids] = await Promise.all([d.store.zcard("users"), d.store.zrange("users", offset, offset + limit - 1, true)]);
  const records = await d.store.mget<UserRecord>(ids.map((id) => `user:${id}`));
  const users = records
    .filter((u): u is UserRecord => u !== null)
    .map((u) => ({
      uid: u.uid,
      username: u.username,
      displayName: u.displayName,
      verifiedBadge: u.verifiedBadge ?? null,
      adminBadges: [...(u.adminBadges ?? []), ...(d.adminEmails[0] === u.email ? [{ id: "amilcargit", label: "AmilcarGit", icon: "♛", color: "rainbow" as const, reason: "Creador de YuiAPI", awardedAt: u.createdAt, awardedBy: "system" }] : [])],
      email: u.email,
      emailVerified: u.emailVerified,
      plan: u.planExpiresAt && u.planExpiresAt <= Date.now() ? "free" : u.plan ?? "free",
      planExpiresAt: u.planExpiresAt ?? null,
      createdAt: u.createdAt,
      status: u.status ?? "active",
      dailyLimit: u.dailyLimit ?? null,
      minuteLimit: u.minuteLimit ?? null,
      role: (u.role ?? (d.adminEmails.includes(u.email) ? "admin" : "user")) as UserRow["role"],
    }));
  return { total, users };
}


export type ActivityEntry = { at: number; type: string; detail: string };

export async function recordUserActivity(d: Deps, uid: string, type: string, detail: string): Promise<void> {
  const at = Date.now();
  const key = `activity:${uid}`;
  await d.store.zadd(key, at, JSON.stringify({ at, type, detail }));
  if (await d.store.zcard(key) > 100) {
    const old = await d.store.zrange(key, 0, -101);
    for (const member of old) await d.store.zrem(key, member);
  }
}

export async function listUserActivity(d: Deps, uid: string): Promise<ActivityEntry[]> {
  const rows = await d.store.zrange(`activity:${uid}`, 0, 49, true);
  return rows.flatMap((raw) => { try { return [JSON.parse(raw) as ActivityEntry]; } catch { return []; } });
}

export async function recordAdminAction(d: Deps, actor: string, target: string, action: string, detail: string): Promise<void> {
  const at = Date.now();
  await d.store.zadd("admin:audit", at, JSON.stringify({ at, actor, target, action, detail }));
  if (await d.store.zcard("admin:audit") > 500) {
    const old = await d.store.zrange("admin:audit", 0, -501);
    for (const member of old) await d.store.zrem("admin:audit", member);
  }
  await recordUserActivity(d, target, action, detail);
}

export async function updateAdminUser(d: Deps, actor: UserRecord, uid: string, patch: Record<string, unknown>): Promise<UserRecord> {
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Usuario no encontrado.");
  if (d.adminEmails.includes(user.email) || user.role === "moderator" && !d.adminEmails.includes(actor.email)) throw new AppError(403, "No puedes modificar esta cuenta protegida.");
  const next: UserRecord = { ...user };
  if (patch.status !== undefined) {
    if (patch.status !== "active" && patch.status !== "suspended") throw new AppError(400, "Estado no válido.");
    next.status = patch.status;
  }
  if (patch.dailyLimit !== undefined) {
    if (patch.dailyLimit !== null && (typeof patch.dailyLimit !== "number" || !Number.isInteger(patch.dailyLimit) || patch.dailyLimit < 1 || patch.dailyLimit > 1000000)) throw new AppError(400, "El límite diario debe estar entre 1 y 1.000.000 o ser null.");
    next.dailyLimit = patch.dailyLimit as number | null;
  }
  if (patch.minuteLimit !== undefined) {
    if (patch.minuteLimit !== null && (typeof patch.minuteLimit !== "number" || !Number.isInteger(patch.minuteLimit) || patch.minuteLimit < 1 || patch.minuteLimit > 10000)) throw new AppError(400, "El límite por minuto debe estar entre 1 y 10.000 o ser null.");
    next.minuteLimit = patch.minuteLimit as number | null;
  }
  if (patch.role !== undefined) {
    if (patch.role !== "user" && patch.role !== "moderator") throw new AppError(400, "Rol no válido.");
    next.role = patch.role;
  }
  if (patch.displayName !== undefined) {
    if (typeof patch.displayName !== "string" || !patch.displayName.trim() || patch.displayName.length > 60) throw new AppError(400, "El nombre debe tener entre 1 y 60 caracteres.");
    next.displayName = patch.displayName.trim();
  }
  if (patch.adminBadges !== undefined) {
    if (!d.adminEmails.includes(actor.email)) throw new AppError(403, "Solo el administrador principal puede administrar insignias especiales.");
    if (!Array.isArray(patch.adminBadges) || patch.adminBadges.length > 12) throw new AppError(400, "Puedes asignar hasta 12 insignias.");
    const colors = ["gold", "blue", "purple", "pink", "green", "rainbow"];
    const badges: AdminBadge[] = [];
    const previousBadges = new Map((user.adminBadges ?? []).map((badge) => [badge.id, badge]));
    for (const raw of patch.adminBadges) {
      if (!raw || typeof raw !== "object") throw new AppError(400, "Insignia no válida.");
      const item = raw as Record<string, unknown>;
      if (typeof item.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(item.id) || typeof item.label !== "string" || !item.label.trim() || item.label.length > 28 || typeof item.icon !== "string" || !item.icon.trim() || item.icon.length > 8 || !colors.includes(String(item.color))) throw new AppError(400, "Revisa el nombre, icono o color de la insignia.");
      if (item.id === "amilcargit" && d.adminEmails[0] !== actor.email) throw new AppError(403, "La insignia AmilcarGit está reservada al creador.");
      const previous = previousBadges.get(item.id);
      badges.push({ id: item.id, label: item.id === "amilcargit" ? "AmilcarGit" : item.label.trim(), icon: item.id === "amilcargit" ? "♛" : item.icon.trim(), color: item.color as AdminBadge["color"], reason: typeof item.reason === "string" ? item.reason.trim().slice(0, 120) : "", awardedAt: previous?.awardedAt ?? Date.now(), awardedBy: previous?.awardedBy ?? actor.uid });
    }
    if (new Set(badges.map((badge) => badge.id)).size !== badges.length) throw new AppError(400, "No puedes repetir una insignia.");
    next.adminBadges = badges;
  }
  if (patch.verifiedBadge !== undefined) {
    if (!d.adminEmails.includes(actor.email)) throw new AppError(403, "Solo el administrador principal puede asignar insignias de verificación.");
    if (patch.verifiedBadge !== null && patch.verifiedBadge !== "blue" && patch.verifiedBadge !== "gold") throw new AppError(400, "Insignia de verificación no válida.");
    next.verifiedBadge = patch.verifiedBadge as "blue" | "gold" | null;
  }
  await d.store.set(`user:${uid}`, next);
  const changed = Object.keys(patch).join(", ");
  await recordAdminAction(d, actor.uid, uid, "admin_actualizacion", `Campos actualizados: ${changed}`);
  if (next.status === "suspended") await revokeAllSessions(d, uid);
  return next;
}
