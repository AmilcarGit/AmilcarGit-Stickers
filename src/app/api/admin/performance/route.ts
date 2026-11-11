import { json, requireUser, route } from "@/server/http";
import { getApiMetrics } from "@/server/metrics";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  await requireUser(d, req, { admin: true });
  return json(getApiMetrics());
});
