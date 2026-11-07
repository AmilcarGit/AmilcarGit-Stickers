import { setUserPlan } from "@/server/apikeys";
import { recordAdminAction } from "@/server/users";
import { json, readJson, requireUser, routeWith } from "@/server/http";

export const runtime = "nodejs";

export const POST = routeWith<{ uid: string }>(async ({ d, req }, { uid }) => {
  const { user: actor } = await requireUser(d, req, { admin: true });
  const b = await readJson(req, 1_000);
  await setUserPlan(d, uid, b.plan);
  await recordAdminAction(d, actor.uid, uid, "cambio_plan", `Plan asignado: ${String(b.plan)}`);
  return json({ ok: true });
});
