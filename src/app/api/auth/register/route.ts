import { json, readJson, route } from "@/server/http";
import { createSession, sessionCookie } from "@/server/session";
import { registerUser, toMe } from "@/server/users";

export const runtime = "nodejs";

export const POST = route(async ({ d, req, ip }) => {
  const b = await readJson(req, 10_000);
  const { user, emailSent } = await registerUser(
    d,
    { email: String(b.email ?? ""), password: String(b.password ?? ""), username: String(b.username ?? ""), displayName: String(b.displayName ?? ""), referralCode: String(b.referralCode ?? "") },
    ip,
  );
  const s = await createSession(d, user.uid);
  return json({ me: toMe(d, user), emailSent }, 201, { "set-cookie": sessionCookie(s.token, s.maxAge, d.secureCookies) });
});
