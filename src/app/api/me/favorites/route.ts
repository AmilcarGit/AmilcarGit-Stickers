import { json, requireUser, route } from "@/server/http";
import { getPackFor, listFavoriteIds } from "@/server/packs";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  const { user, admin } = await requireUser(d, req);
  const ids = (await listFavoriteIds(d, user.uid)).slice(0, 100);
  const found = await Promise.all(ids.map((id) => getPackFor(d, id, { uid: user.uid, admin })));
  const packs = found.flatMap((f) => (f && f.pack.status === "active" ? [f.pack] : []));
  return json({ packs });
});
