import { AppError } from "@/server/errors";
import { json, optionalUser, route } from "@/server/http";
import { listPacksByOwner } from "@/server/packs";
import { profileByUsername } from "@/server/users";

export const runtime = "nodejs";

export const GET = route<{ username: string }>(async ({ d, req }, { username }) => {
  const a = await optionalUser(d, req);
  const profile = await profileByUsername(d, username, a?.user.uid ?? null);
  if (!profile) throw new AppError(404, "Perfil no encontrado.");
  const packs = await listPacksByOwner(d, profile.uid, a?.user.uid === profile.uid);
  return json({ profile, packs });
});
