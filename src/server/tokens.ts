import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type SessionPayload = { sub: string; jti: string; exp: number };

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Token de sesión firmado con HMAC-SHA256: `payload.firma`. */
export function signToken(secret: string, payload: SessionPayload): string {
  const body = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${b64(sig)}`;
}

export function verifyToken(secret: string, token: string, nowSec = Math.floor(Date.now() / 1000)): SessionPayload | null {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof p.sub !== "string" || typeof p.jti !== "string" || typeof p.exp !== "number" || p.exp <= nowSec) return null;
    return { sub: p.sub, jti: p.jti, exp: p.exp };
  } catch {
    return null;
  }
}

/** Identificador con prefijo (evita que Redis/JSON lo interprete como número). */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

/** Token aleatorio para enlaces de verificación y recuperación. */
export function randomToken(): string {
  return randomBytes(32).toString("hex");
}

/** En la base solo se guarda el hash del token del enlace, nunca el token. */
export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
