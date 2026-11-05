import { revokeApiKey } from "@/server/apikeys";
import { json, requireUser, routeWith } from "@/server/http";

export const runtime = "nodejs";

export const DELETE = routeWith<{ id: string }>(async ({ d, req }, { id }) => {
  const { user } = await requireUser(d, req);
  await revokeApiKey(d, user.uid, id);
  return json({ ok: true });
});
