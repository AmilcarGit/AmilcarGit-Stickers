import type { MeInfo, UserRow } from "@/lib/types";
import { normalizeUsername, validateEmail, validatePassword, validateUsername } from "@/lib/validators";
import type { Deps } from "./deps";
import { resetMail, verificationMail } from "./emails";
import { AppError, ConfigError } from "./errors";
import { MAX_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./password";
import { revokeAllSessions } from "./session";
import { hit } from "./store";
import { newId, randomToken, sha256 } from "./tokens";

export type UserRecord = {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  createdAt: number;
  passHash: string;
  emailVerified: boolean;
  /** Plan de la API (por defecto «free»). Solo lo cambia un moderador. */
  plan?: "free" | "pro" | "ultra";
  status?: "active" | "suspended";
  dailyLimit?: number | null;
  minuteLimit?: number | null;
  role?: "user" | "moderator";
};

const VERIFY_TTL = 60 * 60 * 24;
const RESET_TTL = 60 * 60;
const lc = (s: string) => s.trim().toLowerCase();

export const isAdmin = (d: Deps, u: UserRecord): boolean => u.emailVerified && (d.adminEmails.includes(u.email) || u.role === "moderator");

export function toMe(d: Deps, u: UserRecord): MeInfo {
  return { uid: u.uid, username: u.username, displayName: u.displayName, createdAt: u.createdAt, email: u.email, emailVerified: u.emailVerified, admin: isAdmin(d, u), plan: u.plan ?? "free" };
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
  input: { email: string; password: string; username: string; displayName: string },
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

  const user: UserRecord = {
    uid,
    email,
    username,
    displayName: (input.displayName ?? "").trim().slice(0, 60) || username,
    createdAt: Date.now(),
    passHash: await hashPassword(input.password),
    emailVerified: false,
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
  await d.store.set(`user:${user.uid}`, { ...user, emailVerified: true });
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

export async function saveProfile(d: Deps, uid: string, patch: { displayName?: unknown }): Promise<UserRecord> {
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Cuenta no encontrada.");
  const next = { ...user };
  if (typeof patch.displayName === "string") next.displayName = patch.displayName.trim().slice(0, 60) || user.username;
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
      email: u.email,
      emailVerified: u.emailVerified,
      plan: u.plan ?? "free",
      createdAt: u.createdAt,
      status: u.status ?? "active",
      dailyLimit: u.dailyLimit ?? null,
      minuteLimit: u.minuteLimit ?? null,
      role: u.role ?? (d.adminEmails.includes(u.email) ? "admin" : "user"),
    }));
  return { total, users };
}


export type ActivityEntry = { at: number; type: string; detail: string };

export async function recordUserActivity(d: Deps, uid: string, type: string, detail: string): Promise<void> {
  const at = Date.now();
  await d.store.zadd(`activity:${uid}`, at, JSON.stringify({ at, type, detail }));
}

export async function listUserActivity(d: Deps, uid: string): Promise<ActivityEntry[]> {
  const rows = await d.store.zrange(`activity:${uid}`, 0, 49, true);
  return rows.flatMap((raw) => { try { return [JSON.parse(raw) as ActivityEntry]; } catch { return []; } });
}

export async function recordAdminAction(d: Deps, actor: string, target: string, action: string, detail: string): Promise<void> {
  const at = Date.now();
  await d.store.zadd("admin:audit", at, JSON.stringify({ at, actor, target, action, detail }));
  await recordUserActivity(d, target, action, detail);
}

export async function updateAdminUser(d: Deps, actor: UserRecord, uid: string, patch: Record<string, unknown>): Promise<UserRecord> {
  const user = await getUser(d, uid);
  if (!user) throw new AppError(404, "Usuario no encontrado.");
  if (d.adminEmails.includes(user.email)) throw new AppError(403, "No puedes modificar una cuenta administradora protegida.");
  const next: UserRecord = { ...user };
  if (patch.status !== undefined) {
    if (patch.status !== "active" && patch.status !== "suspended") throw new AppError(400, "Estado no válido.");
    next.status = patch.status;
  }
  if (patch.dailyLimit !== undefined) {
    if (patch.dailyLimit !== null && (!Number.isInteger(patch.dailyLimit) || Number(patch.dailyLimit) < 1 || Number(patch.dailyLimit) > 1000000)) throw new AppError(400, "El límite diario debe estar entre 1 y 1.000.000 o ser null.");
    next.dailyLimit = patch.dailyLimit as number | null;
  }
  if (patch.minuteLimit !== undefined) {
    if (patch.minuteLimit !== null && (!Number.isInteger(patch.minuteLimit) || Number(patch.minuteLimit) < 1 || Number(patch.minuteLimit) > 10000)) throw new AppError(400, "El límite por minuto debe estar entre 1 y 10.000 o ser null.");
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
  await d.store.set(`user:${uid}`, next);
  const changed = Object.keys(patch).join(", ");
  await recordAdminAction(d, actor.uid, uid, "admin_actualizacion", `Campos actualizados: ${changed}`);
  if (next.status === "suspended") await revokeAllSessions(d, uid);
  return next;
}
