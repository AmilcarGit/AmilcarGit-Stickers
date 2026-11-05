import { authenticateApiKey, type Quota } from "./apikeys";
import type { Deps } from "./deps";
import { getDeps } from "./deps";
import { AppError } from "./errors";
import { clientIp } from "./http";
import type { UserRecord } from "./users";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-api-key, authorization",
  "access-control-expose-headers": "x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset",
};

export type V1Ctx = { d: Deps; req: Request; url: URL; ip: string; user: UserRecord; quota: Quota };
type Handler<P> = (c: V1Ctx, params: P) => Promise<Response | Record<string, unknown>>;

function reply(data: Record<string, unknown> | Response, quota?: Quota): Response {
  const headers = new Headers(data instanceof Response ? data.headers : { "content-type": "application/json; charset=utf-8" });
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  headers.set("cache-control", "no-store");
  if (quota) {
    headers.set("x-ratelimit-limit", String(quota.limit));
    headers.set("x-ratelimit-remaining", String(quota.remaining));
    headers.set("x-ratelimit-reset", String(Math.floor(quota.resetAt / 1000)));
  }
  if (data instanceof Response) return new Response(data.body, { status: data.status, headers });
  return new Response(JSON.stringify({ ok: true, ...data }), { status: 200, headers });
}

function fail(status: number, error: string): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(JSON.stringify({ ok: false, error }), { status, headers });
}

export function apiKeyFrom(req: Request, url: URL): string | null {
  const h = req.headers.get("x-api-key");
  if (h) return h.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return url.searchParams.get("apikey");
}

async function run<P>(req: Request, params: P, fn: Handler<P>): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  let quota: Quota | undefined;
  try {
    const d = getDeps();
    const url = new URL(req.url);
    const auth = await authenticateApiKey(d, apiKeyFrom(req, url));
    quota = auth.quota;
    return reply(await fn({ d, req, url, ip: clientIp(req), user: auth.user, quota }, params), quota);
  } catch (err) {
    if (err instanceof AppError) {
      const res = fail(err.status, err.message);
      if (quota) res.headers.set("x-ratelimit-remaining", String(quota.remaining));
      return res;
    }
    console.error("Error inesperado en la API v1:", err instanceof Error ? err.message : "desconocido");
    return fail(500, "Ocurrió un error en el servidor. Inténtalo otra vez.");
  }
}

/** Ruta pública de la API: exige clave, descuenta cuota y responde `{ ok, ... }`. */
export function v1(fn: Handler<undefined>) {
  return (req: Request): Promise<Response> => run(req, undefined, fn);
}

export function v1With<P>(fn: Handler<P>) {
  return async (req: Request, extra: { params: Promise<P> }): Promise<Response> => run(req, await extra.params, fn);
}

/** Para OPTIONS (preflight): no lleva clave. */
export const preflight = (): Response => new Response(null, { status: 204, headers: CORS });
