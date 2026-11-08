import { textSticker } from "@/server/stickerart";
import { preflight, v1 } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 20;
export const OPTIONS = preflight;

/** Texto a sticker: /sticker/text?text=Hola&color=ff4fa3&outline=ffffff → WebP 512x512 transparente. */
export const GET = v1(async ({ url }) => {
  const sp = url.searchParams;
  const out = await textSticker(sp.get("text"), sp.get("color"), sp.get("outline"));
  return new Response(out.bytes as unknown as BodyInit, {
    headers: { "content-type": "image/webp", "content-disposition": 'inline; filename="texto.webp"', "x-sticker-lines": String(out.lines) },
  });
});
