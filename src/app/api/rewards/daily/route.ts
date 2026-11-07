import { json, requireUser, route } from "@/server/http";
import { claimDailyBonus, getRewards } from "@/server/rewards";

export const runtime = "nodejs";

export const POST = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req, { verified: true });
  const bonus = await claimDailyBonus(d, user.uid);
  return json({ bonus, rewards: await getRewards(d, user.uid) });
});
