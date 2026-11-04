import { json, readJson, requireUser, routeWith } from "@/server/http";
import { setFavorite } from "@/server/packs";

export const runtime = "nodejs";

export const POST = routeWith<{ id: string }>(async ({ d, req }, { id }) => {
  const { user } = await requireUser(d, req);
  const b = await readJson(req, 1_000);
  return json(await setFavorite(d, user.uid, id, b.on === true));
});
