import { json, readJson, route } from "@/server/http";
import { requestReset } from "@/server/users";

export const runtime = "nodejs";

export const POST = route(async ({ d, req, ip }) => {
  const b = await readJson(req, 2_000);
  await requestReset(d, String(b.email ?? ""), ip);
  return json({ ok: true });
});
