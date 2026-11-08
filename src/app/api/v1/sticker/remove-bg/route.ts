import { AppError } from "@/server/errors";
import { removeBackground } from "@/server/stickerart";
import { MAX_INPUT_BYTES, convertToSticker } from "@/server/sticker-convert";
import { preflight, v1 } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 30;
export const OPTIONS = preflight;

/**
 * Quita un fondo de color liso. Cuerpo: la imagen. ?tolerance=5-120 (por defecto 40);
 * ?format=webp (sticker 512x512, por defecto) o png (tamaño original, transparente).
 */
export const POST = v1(async ({ req, url }) => {
  if (Number(req.headers.get("content-length") ?? "0") > MAX_INPUT_BYTES + 100_000) throw new AppError(413, "La imagen pesa más de 5 MB.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  const sp = url.searchParams;
  const out = await removeBackground(bytes, sp.get("tolerance"));
  const png = sp.get("format") === "png";
  const body = png ? out.png : (await convertToSticker(out.png, { fit: "contain", quality: 85 })).bytes;
  return new Response(body as unknown as BodyInit, {
    headers: {
      "content-type": png ? "image/png" : "image/webp",
      "content-disposition": `inline; filename="sin-fondo.${png ? "png" : "webp"}"`,
      "x-removed-percent": String(out.removedPct),
      "x-background-color": out.background,
    },
  });
});
