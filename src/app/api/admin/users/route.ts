import { json, requireUser, route } from "@/server/http";
import { listUsers } from "@/server/users";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  await requireUser(d, req, { admin: true });
  const sp = new URL(req.url).searchParams;
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 50));
  return json(await listUsers(d, offset, limit));
});
