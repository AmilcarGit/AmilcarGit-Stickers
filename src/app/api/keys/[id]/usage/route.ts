import { listApiKeyUsage } from "@/server/apikeys";
import { json, requireUser, routeWith } from "@/server/http";

export const runtime = "nodejs";

export const GET = routeWith<{ id: string }>(async ({ d, req }, { id }) => {
  const { user } = await requireUser(d, req);
  const usage = await listApiKeyUsage(d, user.uid, id);
  return json({ usage });
});
