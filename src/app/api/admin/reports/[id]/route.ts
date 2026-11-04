import { json, readJson, requireUser, route } from "@/server/http";
import { resolveReport } from "@/server/reports";

export const runtime = "nodejs";

export const POST = route<{ id: string }>(async ({ d, req }, { id }) => {
  await requireUser(d, req, { admin: true });
  const b = await readJson(req, 1_000);
  await resolveReport(d, id, b.action);
  return json({ ok: true });
});
