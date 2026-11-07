import { json, requireUser, route } from "@/server/http";
import { getRewards } from "@/server/rewards";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  return json(await getRewards(d, user.uid));
});
