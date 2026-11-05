import sharp from "sharp";
import { WA } from "@/lib/whatsapp";
import { AppError } from "./errors";

export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_FRAMES = 60;
const QUALITIES = [85, 70, 55, 40, 28, 18];

export type StickerOptions = { fit: "contain" | "cover"; quality: number };

export function readOptions(sp: URLSearchParams): StickerOptions {
  const fit = sp.get("fit") === "cover" ? "cover" : "contain";
  const q = Number.parseInt(sp.get("quality") ?? "", 10);
  return { fit, quality: Number.isFinite(q) ? Math.min(100, Math.max(10, q)) : QUALITIES[0] };
}

/**
 * Convierte una imagen o GIF/WebP animado en un sticker de WhatsApp: WebP 512x512 con fondo
 * transparente que cabe en 100 KB (estático) o 500 KB (animado), bajando la calidad si hace falta.
 */
export async function convertToSticker(input: Uint8Array, opts: StickerOptions): Promise<{ bytes: Uint8Array; animated: boolean; quality: number }> {
  if (input.length === 0) throw new AppError(400, "No se recibió ninguna imagen.");
  if (input.length > MAX_INPUT_BYTES) throw new AppError(413, "La imagen pesa más de 5 MB.");

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { animated: true, limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new AppError(400, "El archivo no es una imagen válida (usa PNG, JPG, WebP o GIF).");
  }
  if (!meta.format || !["png", "jpeg", "webp", "gif"].includes(meta.format)) {
    throw new AppError(400, "Formato no admitido. Usa PNG, JPG, WebP o GIF.");
  }
  const animated = (meta.pages ?? 1) > 1;
  if (animated && (meta.pages ?? 1) > MAX_FRAMES) {
    throw new AppError(400, `La animación tiene demasiados cuadros (máximo ${MAX_FRAMES}).`);
  }
  const max = animated ? WA.animatedMaxBytes : WA.staticMaxBytes;
  const start = QUALITIES.filter((q) => q <= opts.quality);

  for (const quality of start.length > 0 ? start : [QUALITIES[QUALITIES.length - 1]]) {
    let out: Buffer;
    try {
      out = await sharp(input, { animated, limitInputPixels: 40_000_000 })
        .resize(WA.size, WA.size, { fit: opts.fit, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality, alphaQuality: 100, effort: 4, loop: 0 })
        .toBuffer();
    } catch {
      throw new AppError(400, "No se pudo convertir la imagen.");
    }
    if (out.length <= max) return { bytes: new Uint8Array(out), animated, quality };
  }
  throw new AppError(413, `No se logró que el sticker pese menos de ${Math.round(max / 1024)} KB. Usa una imagen más simple o más corta.`);
}
