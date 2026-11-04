import { json, requireUser, route } from "@/server/http";
import { listPacksByOwner } from "@/server/packs";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  return json({ packs: await listPacksByOwner(d, user.uid, true) });
});
