import { authenticateApiKey, type Quota } from "./apikeys";
import type { Deps } from "./deps";
import { getDeps } from "./deps";
import { AppError } from "./errors";
import { clientIp } from "./http";
import { hit } from "./store";
import { isIpBlocked, recordSecurityEvent } from "./security";
import type { UserRecord } from "./users";
import { recordApiMetric } from "./metrics";

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
  const startedAt = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;
  let status = 500;
  try {
    const d = getDeps();
    const ip = clientIp(req);
    const blocked = await isIpBlocked(d, ip);
    if (blocked) {
      if (await hit(d.store, `security:block-hit:${ip}`, 1, 60)) {
        await recordSecurityEvent(d, { type: "rate_limited", severity: "warning", ip, path, detail: "Solicitud rechazada desde una IP bloqueada" }).catch(() => undefined);
      }
      const response = fail(403, "Esta dirección IP está bloqueada temporalmente.");
      status = response.status;
      return response;
    }
    const auth = await authenticateApiKey(d, apiKeyFrom(req, url));
    const response = reply(await fn({ d, req, url, ip, user: auth.user, quota: auth.quota }, params), auth.quota);
    status = response.status;
    return response;
  } catch (err) {
    if (err instanceof AppError) {
      try {
        const d = getDeps();
        const ip = clientIp(req);
        if (err.status === 401 && await hit(d.store, `security:auth-event:${ip}`, 1, 60)) {
          await recordSecurityEvent(d, { type: "api_key_rejected", severity: "warning", ip, path, detail: "Clave de API ausente, inválida o revocada" }).catch(() => undefined);
        } else if (err.status === 429 && await hit(d.store, `security:rate-event:${ip}`, 1, 60)) {
          await recordSecurityEvent(d, { type: "rate_limited", severity: "warning", ip, path, detail: "Se alcanzó un límite de solicitudes" }).catch(() => undefined);
        }
      } catch {
        // La respuesta original no debe quedar bloqueada por un fallo al registrar el evento.
      }
      const response = fail(err.status, err.message);
      status = response.status;
      return response;
    }
    console.error("Error inesperado en la API v1:", err instanceof Error ? err.message : "desconocido");
    const response = fail(500, "Ocurrió un error en el servidor. Inténtalo otra vez.");
    status = response.status;
    return response;
  } finally {
    recordApiMetric(path, status, Date.now() - startedAt);
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
