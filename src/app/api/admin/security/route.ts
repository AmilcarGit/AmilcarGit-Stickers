import { json, readJson, requireUser, route } from "@/server/http";
import { blockIp, securitySnapshot } from "@/server/security";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  await requireUser(d, req, { admin: true });
  return json(await securitySnapshot(d));
});

export const POST = route(async ({ d, req }) => {
  await requireUser(d, req, { admin: true });
  const body = await readJson(req, 4096);
  const block = await blockIp(d, body.ip, body.durationSeconds, body.reason);
  return json({ block }, 201);
});
