import { json, readJson, requireUser, route } from "@/server/http";
import { saveProfile, toMe } from "@/server/users";

export const runtime = "nodejs";

export const PATCH = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  const b = await readJson(req, 10_000);
  const next = await saveProfile(d, user.uid, b);
  return json({ me: toMe(d, next) });
});
