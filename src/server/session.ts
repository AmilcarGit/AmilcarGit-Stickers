import type { Deps } from "./deps";
import { newId, signToken, verifyToken } from "./tokens";

export const COOKIE_NAME = "sid";
export const SESSION_SECONDS = 60 * 60 * 24 * 30;

/**
 * Sesión = token firmado en cookie HttpOnly + registro en Redis. Cerrar sesión o cambiar la
 * contraseña borra el registro, así que un token robado deja de servir aunque no haya vencido.
 */
export async function createSession(d: Deps, uid: string, nowSec = Math.floor(Date.now() / 1000)): Promise<{ token: string; maxAge: number }> {
  const jti = newId("j");
  await d.store.set(`sess:${jti}`, uid, { ex: SESSION_SECONDS });
  await d.store.sadd(`usess:${uid}`, jti);
  return { token: signToken(d.secret, { sub: uid, jti, exp: nowSec + SESSION_SECONDS }), maxAge: SESSION_SECONDS };
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export async function readSession(d: Deps, req: Request, nowSec = Math.floor(Date.now() / 1000)): Promise<{ uid: string; jti: string } | null> {
  const raw = readCookie(req.headers.get("cookie"), COOKIE_NAME);
  if (!raw) return null;
  const payload = verifyToken(d.secret, raw, nowSec);
  if (!payload) return null;
  const uid = await d.store.get<string>(`sess:${payload.jti}`);
  return uid && uid === payload.sub ? { uid, jti: payload.jti } : null;
}

export async function destroySession(d: Deps, uid: string, jti: string): Promise<void> {
  await d.store.del(`sess:${jti}`);
  await d.store.srem(`usess:${uid}`, jti);
}

export async function revokeAllSessions(d: Deps, uid: string): Promise<void> {
  const ids = await d.store.smembers(`usess:${uid}`);
  await d.store.del(...ids.map((j) => `sess:${j}`), `usess:${uid}`);
}

export function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function clearedCookie(secure: boolean): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
