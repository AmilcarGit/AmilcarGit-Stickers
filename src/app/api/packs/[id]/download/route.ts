import { json, route } from "@/server/http";
import { registerDownload } from "@/server/packs";

export const runtime = "nodejs";

export const POST = route<{ id: string }>(async ({ d, ip }, { id }) => {
  await registerDownload(d, id, ip);
  return json({ ok: true });
});
