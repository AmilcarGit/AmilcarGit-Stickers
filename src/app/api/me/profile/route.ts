import { json, readJson, requireUser, route } from "@/server/http";
import { setRankingVisibility } from "@/server/profile";
import { saveProfile, toMe } from "@/server/users";

export const runtime = "nodejs";

export const PATCH = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  const b = await readJson(req, 10_000);
  let next = await saveProfile(d, user.uid, b);
  if (typeof b.showInRanking === "boolean") next = await setRankingVisibility(d, user.uid, b.showInRanking);
  return json({ me: toMe(d, next) });
});
