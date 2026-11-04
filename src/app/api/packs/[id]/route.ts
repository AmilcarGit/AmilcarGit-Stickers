import { deleteBlobs } from "@/server/blob";
import { AppError } from "@/server/errors";
import { json, optionalUser, readJson, requireUser, routeWith } from "@/server/http";
import { deletePack, getPackFor, updatePack } from "@/server/packs";

export const runtime = "nodejs";

type P = { id: string };

export const GET = routeWith<P>(async ({ d, req }, { id }) => {
  const a = await optionalUser(d, req);
  const found = await getPackFor(d, id, a ? { uid: a.user.uid, admin: a.admin } : null);
  if (!found) throw new AppError(404, "Paquete no encontrado.");
  return json(found);
});

export const PATCH = routeWith<P>(async ({ d, req }, { id }) => {
  const { user } = await requireUser(d, req);
  return json({ pack: await updatePack(d, user, id, await readJson(req, 20_000)) });
});

export const DELETE = routeWith<P>(async ({ d, req }, { id }) => {
  const { user, admin } = await requireUser(d, req);
  const urls = await deletePack(d, { uid: user.uid, admin }, id);
  await deleteBlobs(urls);
  return json({ ok: true });
});
