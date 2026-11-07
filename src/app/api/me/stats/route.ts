import { json, requireUser, route } from "@/server/http";
import { userMonthlyUsage } from "@/server/profile";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  return json({ requestsThisMonth: await userMonthlyUsage(d, user.uid) });
});
