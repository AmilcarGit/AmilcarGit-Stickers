import { json, optionalUser, route } from "@/server/http";
import { toMe } from "@/server/users";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  const a = await optionalUser(d, req);
  return json({ me: a ? toMe(d, a.user) : null });
});
