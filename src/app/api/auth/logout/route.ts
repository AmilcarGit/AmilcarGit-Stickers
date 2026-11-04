import { json, optionalUser, route } from "@/server/http";
import { clearedCookie, destroySession } from "@/server/session";

export const runtime = "nodejs";

export const POST = route(async ({ d, req }) => {
  const a = await optionalUser(d, req);
  if (a) await destroySession(d, a.user.uid, a.jti);
  return json({ ok: true }, 200, { "set-cookie": clearedCookie(d.secureCookies) });
});
