import { AppError } from "@/server/errors";
import { getPackFor, publicPack } from "@/server/packs";
import { preflight, v1With } from "@/server/v1";

export const runtime = "nodejs";
export const OPTIONS = preflight;

export const GET = v1With<{ id: string }>(async ({ d }, { id }) => {
  const found = await getPackFor(d, id, null);
  if (!found || !found.pack.listed) throw new AppError(404, "Paquete no encontrado.");
  return { pack: publicPack(found.pack, d.siteUrl) };
});
