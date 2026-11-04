import { json, readJson, route } from "@/server/http";
import { verifyEmail } from "@/server/users";

export const runtime = "nodejs";

export const POST = route(async ({ d, req }) => {
  const b = await readJson(req, 2_000);
  await verifyEmail(d, String(b.token ?? ""));
  return json({ ok: true });
});
