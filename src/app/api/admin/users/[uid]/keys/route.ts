import { createAdminApiKey, listAdminApiKeys } from "@/server/apikeys";
import { getUser, recordAdminAction } from "@/server/users";
import { json, readJson, requireUser, routeWith } from "@/server/http";

export const runtime = "nodejs";

export const GET = routeWith<{ uid: string }>(async ({ d, req }, { uid }) => {
  await requireUser(d, req, { admin: true });
  const user = await getUser(d, uid);
  if (!user) return json({ error: "Usuario no encontrado." }, 404);
  return json({ keys: await listAdminApiKeys(d, uid) });
});

export const POST = routeWith<{ uid: string }>(async ({ d, req }, { uid }) => {
  const { user: actor } = await requireUser(d, req, { admin: true });
  const body = await readJson(req, 1000);
  const created = await createAdminApiKey(d, uid, body.name);
  await recordAdminAction(d, actor.uid, uid, "admin_api_key_creada", `Clave creada: ${created.info.name} (${created.info.id})`);
  return json(created, 201);
});
