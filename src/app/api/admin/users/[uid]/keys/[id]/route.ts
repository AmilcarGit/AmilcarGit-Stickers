import { listApiKeyUsage, revokeApiKey, rotateApiKey, updateApiKeyLimits } from "@/server/apikeys";
import { getUser, recordAdminAction } from "@/server/users";
import { json, readJson, requireUser, routeWith } from "@/server/http";

export const runtime = "nodejs";

export const GET = routeWith<{ uid: string; id: string }>(async ({ d, req }, { uid, id }) => {
  await requireUser(d, req, { admin: true });
  const user = await getUser(d, uid);
  if (!user) return json({ error: "Usuario no encontrado." }, 404);
  return json({ history: await listApiKeyUsage(d, uid, id) });
});

export const PATCH = routeWith<{ uid: string; id: string }>(async ({ d, req }, { uid, id }) => {
  const { user: actor } = await requireUser(d, req, { admin: true });
  const body = await readJson(req, 1000);
  const key = await updateApiKeyLimits(d, uid, id, body);
  await recordAdminAction(d, actor.uid, uid, "admin_api_key_limites", `Límites modificados para ${key.name} (${id})`);
  return json({ key });
});

export const DELETE = routeWith<{ uid: string; id: string }>(async ({ d, req }, { uid, id }) => {
  const { user: actor } = await requireUser(d, req, { admin: true });
  await revokeApiKey(d, uid, id);
  await recordAdminAction(d, actor.uid, uid, "admin_api_key_revocada", `Clave revocada: ${id}`);
  return json({ ok: true });
});

export const POST = routeWith<{ uid: string; id: string }>(async ({ d, req }, { uid, id }) => {
  const { user: actor } = await requireUser(d, req, { admin: true });
  const rotated = await rotateApiKey(d, uid, id);
  await recordAdminAction(d, actor.uid, uid, "admin_api_key_rotada", `Clave rotada: ${id} → ${rotated.info.id}`);
  return json(rotated);
});
