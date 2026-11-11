import { rotateApiKey } from "@/server/apikeys";
import { json, requireUser, routeWith } from "@/server/http";

export const runtime = "nodejs";

export const POST = routeWith<{ id: string }>(async ({ d, req }, { id }) => {
  const { user } = await requireUser(d, req, { verified: true });
  const result = await rotateApiKey(d, user.uid, id);
  return json(result);
});
