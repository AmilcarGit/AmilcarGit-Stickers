import type { Deps } from "./deps";
import { getDeps } from "./deps";
import { AppError } from "./errors";
import { readSession } from "./session";
import { getUser, isAdmin, type UserRecord } from "./users";

export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
}

/**
 * Defensa contra CSRF en peticiones que cambian datos: el navegador siempre envía Origin
 * (o Sec-Fetch-Site) y debe coincidir con este sitio.
 */
export function assertSameOrigin(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === host;
    } catch {
      ok = false;
    }
    if (!ok) throw new AppError(403, "Solicitud no permitida desde otro sitio.");
    return;
  }
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new AppError(403, "Solicitud no permitida desde otro sitio.");
}

/** Lee un cuerpo JSON (objeto) con tope de tamaño. */
export async function readJson(req: Request, maxBytes = 1_000_000): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new AppError(413, "La solicitud es demasiado grande.");
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError(413, "La solicitud es demasiado grande.");
  try {
    const v: unknown = JSON.parse(text || "{}");
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* cae abajo */
  }
  throw new AppError(400, "Solicitud inválida.");
}

export type Ctx = { d: Deps; req: Request; ip: string };

type Extra<P> = { params: Promise<P> };

async function run<P>(req: Request, params: P, fn: (c: Ctx, params: P) => Promise<Response>): Promise<Response> {
  try {
    assertSameOrigin(req);
    return await fn({ d: getDeps(), req, ip: clientIp(req) }, params);
  } catch (err) {
    if (err instanceof AppError) return json({ error: err.message }, err.status);
    console.error("Error inesperado en la API:", err instanceof Error ? err.message : "desconocido");
    return json({ error: "Ocurrió un error en el servidor. Inténtalo otra vez." }, 500);
  }
}

/** Ruta sin parámetros de URL: comprueba origen, arma dependencias y convierte errores en respuestas JSON. */
export function route(fn: (c: Ctx) => Promise<Response>) {
  return (req: Request): Promise<Response> => run(req, undefined, (c) => fn(c));
}

/** Ruta con parámetros de URL (`[id]`, `[username]`): en Next 15 `params` es una promesa. */
export function routeWith<P>(fn: (c: Ctx, params: P) => Promise<Response>) {
  return async (req: Request, extra: Extra<P>): Promise<Response> => {
    let params: P;
    try {
      params = await extra.params;
    } catch {
      return json({ error: "Solicitud inválida." }, 400);
    }
    return run(req, params, fn);
  };
}

export type Authed = { user: UserRecord; admin: boolean; jti: string };

export async function optionalUser(d: Deps, req: Request): Promise<Authed | null> {
  const s = await readSession(d, req);
  if (!s) return null;
  const user = await getUser(d, s.uid);
  return user ? { user, admin: isAdmin(d, user), jti: s.jti } : null;
}

export async function requireUser(d: Deps, req: Request, opts: { verified?: boolean; admin?: boolean } = {}): Promise<Authed> {
  const a = await optionalUser(d, req);
  if (!a) throw new AppError(401, "Inicia sesión para continuar.");
  if (opts.admin && !a.admin) throw new AppError(403, "No tienes permiso para esto.");
  if (opts.verified && !a.user.emailVerified) throw new AppError(403, "Verifica tu correo electrónico antes de continuar.");
  return a;
}
