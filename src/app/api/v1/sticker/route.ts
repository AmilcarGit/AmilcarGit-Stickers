import { AppError } from "@/server/errors";
import { MAX_INPUT_BYTES, convertToSticker, readOptions } from "@/server/sticker-convert";
import { preflight, v1 } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 30;
export const OPTIONS = preflight;

async function readImage(req: Request): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length") ?? "0") > MAX_INPUT_BYTES + 100_000) throw new AppError(413, "La imagen pesa más de 5 MB.");
  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const file = (await req.formData().catch(() => null))?.get("file");
    if (!(file instanceof File)) throw new AppError(400, "Envía la imagen en el campo «file».");
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Uint8Array(await req.arrayBuffer());
}

/**
 * Convierte una imagen/GIF en sticker de WhatsApp (WebP 512x512). Cuerpo: la imagen en crudo o
 * multipart con el campo «file». Responde el WebP; con ?format=json devuelve base64 y datos.
 */
export const POST = v1(async ({ req, url }) => {
  const out = await convertToSticker(await readImage(req), readOptions(url.searchParams));
  if (url.searchParams.get("format") === "json") {
    return { animated: out.animated, quality: out.quality, bytes: out.bytes.length, mimetype: "image/webp", base64: Buffer.from(out.bytes).toString("base64") };
  }
  return new Response(out.bytes as unknown as BodyInit, {
    headers: { "content-type": "image/webp", "x-sticker-animated": String(out.animated), "content-disposition": 'inline; filename="sticker.webp"' },
  });
});
