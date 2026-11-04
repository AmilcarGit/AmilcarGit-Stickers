import { json, readJson, route } from "@/server/http";
import { resetPassword } from "@/server/users";

export const runtime = "nodejs";

export const POST = route(async ({ d, req }) => {
  const b = await readJson(req, 4_000);
  await resetPassword(d, String(b.token ?? ""), String(b.password ?? ""));
  return json({ ok: true });
});
