import { json, readJson, route } from "@/server/http";
import { createSession, sessionCookie } from "@/server/session";
import { loginUser, toMe } from "@/server/users";

export const runtime = "nodejs";

export const POST = route(async ({ d, req, ip }) => {
  const b = await readJson(req, 10_000);
  const user = await loginUser(d, { email: String(b.email ?? ""), password: String(b.password ?? "") }, ip);
  const s = await createSession(d, user.uid);
  return json({ me: toMe(d, user) }, 200, { "set-cookie": sessionCookie(s.token, s.maxAge, d.secureCookies) });
});
