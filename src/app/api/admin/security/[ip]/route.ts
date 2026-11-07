import { json, requireUser, routeWith } from "@/server/http";
import { unblockIp } from "@/server/security";

export const runtime = "nodejs";

export const DELETE = routeWith<{ ip: string }>(async ({ d, req }, params) => {
  await requireUser(d, req, { admin: true });
  await unblockIp(d, decodeURIComponent(params.ip));
  return json({ ok: true });
});
