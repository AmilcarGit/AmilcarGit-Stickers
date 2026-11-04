import { json, requireUser, route } from "@/server/http";
import { listOpenReports } from "@/server/reports";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  await requireUser(d, req, { admin: true });
  return json({ reports: await listOpenReports(d) });
});
