import { AppError } from "@/server/errors";
import { getPackFor, registerDownload } from "@/server/packs";
import { buildPackFile } from "@/server/pack-download";
import { preflight, v1With } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 30;
export const OPTIONS = preflight;

/** Descarga un paquete público como ZIP (por defecto) o .wastickers: ?format=zip|wastickers */
export const GET = v1With<{ id: string }>(async ({ d, url, ip }, { id }) => {
  const format = url.searchParams.get("format") === "wastickers" ? "wastickers" : "zip";
  const found = await getPackFor(d, id, null);
  if (!found || !found.pack.listed) throw new AppError(404, "Paquete no encontrado.");
  const file = await buildPackFile(found.pack, format, d.siteUrl);
  await registerDownload(d, id, ip);
  return new Response(file.bytes as unknown as BodyInit, {
    headers: { "content-type": file.contentType, "content-disposition": `attachment; filename="${file.filename}"` },
  });
});
