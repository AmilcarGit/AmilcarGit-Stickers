import { AppError } from "@/server/errors";
import { json, requireUser, route } from "@/server/http";
import { MAX_AVATAR_BYTES, removeAvatar, setAvatar } from "@/server/profile";
import { toMe } from "@/server/users";

export const runtime = "nodejs";
export const maxDuration = 15;

/** Sube la foto de perfil: cuerpo = la imagen en crudo (PNG, JPG, WebP o GIF, máx. 2 MB). */
export const POST = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  if (Number(req.headers.get("content-length") ?? "0") > MAX_AVATAR_BYTES + 10_000) throw new AppError(413, "La foto pesa más de 2 MB.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  return json({ me: toMe(d, await setAvatar(d, user.uid, bytes)) });
});

export const DELETE = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  return json({ me: toMe(d, await removeAvatar(d, user.uid)) });
});
