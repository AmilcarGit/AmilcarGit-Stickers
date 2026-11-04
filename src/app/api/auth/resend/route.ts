import { json, requireUser, route } from "@/server/http";
import { resendVerification } from "@/server/users";

export const runtime = "nodejs";

export const POST = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  await resendVerification(d, user.uid);
  return json({ ok: true });
});
