import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verificación de tokens de Firebase Auth en el servidor sin Admin SDK:
 * se valida la firma con las claves públicas de Google, el emisor y la audiencia.
 */
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type VerifiedUser = { uid: string; emailVerified: boolean };

export async function verifyRequest(req: Request): Promise<VerifiedUser | null> {
  const match = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!match || !projectId) return null;
  try {
    const { payload } = await jwtVerify(match[1], JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
    return { uid: payload.sub, emailVerified: payload.email_verified === true };
  } catch {
    return null;
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
