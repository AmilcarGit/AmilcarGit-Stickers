import { updateApiKeyLimits } from "@/server/apikeys";
import { json, readJson, requireUser, routeWith } from "@/server/http";

export const runtime = "nodejs";

export const PATCH = routeWith<{ id: string }>(async ({ d, req }, { id }) => {
  const { user } = await requireUser(d, req, { verified: true });
  const body = await readJson(req, 1_000);
  const info = await updateApiKeyLimits(d, user.uid, id, {
    dailyLimit: body.dailyLimit,
    minuteLimit: body.minuteLimit,
  });
  return json({ info });
});
