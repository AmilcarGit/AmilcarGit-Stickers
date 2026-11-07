import { json, readJson, requireUser, routeWith } from "@/server/http";
import { getUser, listUserActivity, updateAdminUser } from "@/server/users";

export const runtime = "nodejs";

export const GET = routeWith<{ uid: string }>(async ({ d, req }, { uid }) => {
  const { user: actor } = await requireUser(d, req, { admin: true });
  const user = await getUser(d, uid);
  if (!user) return json({ error: "Usuario no encontrado." }, 404);
  const { passHash: _secret, ...profile } = user;
  const activity = await listUserActivity(d, uid);
  return json({ canManageRoles: d.adminEmails.includes(actor.email), user: { ...profile, plan: user.plan ?? "free", status: user.status ?? "active", role: user.role ?? (d.adminEmails.includes(user.email) ? "admin" : "user"), dailyLimit: user.dailyLimit ?? null, minuteLimit: user.minuteLimit ?? null }, activity });
});

export const PATCH = routeWith<{ uid: string }>(async ({ d, req }, { uid }) => {
  const { user: actor } = await requireUser(d, req, { admin: true });
  const body = await readJson(req, 2_000);
  const updated = await updateAdminUser(d, actor, uid, body);
  return json({ ok: true, user: { uid: updated.uid, username: updated.username, displayName: updated.displayName, email: updated.email, emailVerified: updated.emailVerified, plan: updated.plan ?? "free", createdAt: updated.createdAt, status: updated.status ?? "active", dailyLimit: updated.dailyLimit ?? null, minuteLimit: updated.minuteLimit ?? null, role: updated.role ?? (d.adminEmails.includes(updated.email) ? "admin" : "user") } });
});
