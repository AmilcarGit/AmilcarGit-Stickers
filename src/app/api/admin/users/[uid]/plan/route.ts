import { setUserPlan } from "@/server/apikeys";
import { recordAdminAction } from "@/server/users";
import { json, readJson, requireUser, routeWith } from "@/server/http";

export const runtime = "nodejs";

export const POST = routeWith<{ uid: string }>(async ({ d, req }, { uid }) => {
  const { user: actor } = await requireUser(d, req, { admin: true });
  const body = await readJson(req, 1000);
  await setUserPlan(d, uid, body.plan, body.durationDays);
  await recordAdminAction(d, actor.uid, uid, "cambio_plan", `Plan asignado: ${String(body.plan)}${body.durationDays ? ` durante ${String(body.durationDays)} días` : " permanente"}`);
  return json({ ok: true });
});
