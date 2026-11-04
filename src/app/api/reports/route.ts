import { json, readJson, requireUser, route } from "@/server/http";
import { createReport } from "@/server/reports";

export const runtime = "nodejs";

export const POST = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  await createReport(d, user.uid, await readJson(req, 5_000));
  return json({ ok: true }, 201);
});
