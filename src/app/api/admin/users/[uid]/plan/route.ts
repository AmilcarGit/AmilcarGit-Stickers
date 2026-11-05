import { setUserPlan } from "@/server/apikeys";
import { json, readJson, requireUser, routeWith } from "@/server/http";

export const runtime = "nodejs";

export const POST = routeWith<{ uid: string }>(async ({ d, req }, { uid }) => {
  await requireUser(d, req, { admin: true });
  const b = await readJson(req, 1_000);
  await setUserPlan(d, uid, b.plan);
  return json({ ok: true });
});
