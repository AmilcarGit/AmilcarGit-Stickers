import { json, readJson, requireUser, routeWith } from "@/server/http";
import { getUser, recordAdminAction } from "@/server/users";
import { AppError } from "@/server/errors";

export const runtime = "nodejs";

export const POST = routeWith<{ uid: string }>(async ({ d, req }, { uid }) => {
  const { user: actor } = await requireUser(d, req, { admin: true });
  const body = await readJson(req, 10_000);
  const plan = body.plan;
  const days = body.days;
  if ((plan !== "pro" && plan !== "ultra") || typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 365) {
    throw new AppError(400, "El regalo debe ser Pro o Ultra y durar entre 1 y 365 días.");
  }
  const target = await getUser(d, uid);
  if (!target) throw new AppError(404, "Usuario no encontrado.");
  if (d.adminEmails.includes(target.email)) throw new AppError(403, "No puedes modificar la cuenta administradora principal.");
  const now = Date.now();
  const start = target.planExpiresAt && target.planExpiresAt > now ? target.planExpiresAt : now;
  const next = { ...target, plan, planExpiresAt: start + days * 86_400_000 };
  await d.store.set(`user:${uid}`, next);
  await recordAdminAction(d, actor.uid, uid, "admin_regalo_plan", `Regalo de ${days} días de ${plan.toUpperCase()}`);
  return json({ plan: next.plan, planExpiresAt: next.planExpiresAt });
});
