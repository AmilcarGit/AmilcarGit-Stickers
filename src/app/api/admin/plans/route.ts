import { deleteCustomPlan, listPlans, saveCustomPlan } from "@/server/apikeys";
import { json, readJson, requireUser, route } from "@/server/http";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  await requireUser(d, req, { admin: true });
  return json({ plans: await listPlans(d) });
});

export const POST = route(async ({ d, req }) => {
  await requireUser(d, req, { admin: true });
  const body = await readJson(req, 2000);
  return json({ plan: await saveCustomPlan(d, body) }, 201);
});

export const DELETE = route(async ({ d, req }) => {
  await requireUser(d, req, { admin: true });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  await deleteCustomPlan(d, id);
  return json({ ok: true });
});
