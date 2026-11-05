import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_INPUT_BYTES, convertToSticker, readOptions } from "./sticker-convert";

const photo = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 200, g: 40, b: 90, alpha: 1 } } }).png().toBuffer();

async function fails(p: Promise<unknown>): Promise<number> {
  try {
    await p;
  } catch (e) {
    return (e as { status?: number }).status ?? 0;
  }
  throw new Error("Se esperaba un error.");
}

describe("convertToSticker", () => {
  it("convierte una imagen a WebP 512x512 con transparencia y dentro del peso de WhatsApp", async () => {
    const out = await convertToSticker(new Uint8Array(await photo(800, 600)), { fit: "contain", quality: 85 });
    expect(out.animated).toBe(false);
    expect(out.bytes.length).toBeLessThanOrEqual(100 * 1024);
    const meta = await sharp(out.bytes).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.hasAlpha).toBe(true);
    // con fit=contain, una imagen horizontal deja bordes transparentes arriba y abajo
    const px = await sharp(out.bytes).ensureAlpha().raw().toBuffer();
    expect(px[3]).toBe(0);
  });

  it("rechaza archivos vacíos, enormes y que no son imágenes", async () => {
    expect(await fails(convertToSticker(new Uint8Array(0), readOptions(new URLSearchParams())))).toBe(400);
    expect(await fails(convertToSticker(new Uint8Array(MAX_INPUT_BYTES + 1), readOptions(new URLSearchParams())))).toBe(413);
    expect(await fails(convertToSticker(new TextEncoder().encode("esto no es una imagen"), readOptions(new URLSearchParams())))).toBe(400);
  });

  it("readOptions acota la calidad y elige fit", () => {
    expect(readOptions(new URLSearchParams("fit=cover&quality=999"))).toEqual({ fit: "cover", quality: 100 });
    expect(readOptions(new URLSearchParams("quality=1"))).toEqual({ fit: "contain", quality: 10 });
    expect(readOptions(new URLSearchParams(""))).toEqual({ fit: "contain", quality: 85 });
  });
});
