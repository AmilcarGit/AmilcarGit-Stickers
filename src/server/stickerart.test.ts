import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cleanColor, cleanStickerText, layoutText, removeBackground, textSticker, wrapText } from "./stickerart";

async function fails(p: Promise<unknown>): Promise<{ status: number }> {
  try {
    await p;
  } catch (e) {
    return { status: (e as { status?: number }).status ?? 0 };
  }
  throw new Error("Se esperaba un error.");
}

describe("texto a sticker", () => {
  it("limpia el texto: sin emojis, espacios colapsados y máximo 120", () => {
    expect(cleanStickerText("  Hola   mundo 🌸 ñandú  ")).toBe("Hola mundo ñandú");
    expect(cleanStickerText("a".repeat(300))).toHaveLength(120);
  });

  it("rechaza texto vacío o solo emojis", () => {
    expect(() => cleanStickerText("🌸🌸")).toThrow();
    expect(() => cleanStickerText(null)).toThrow();
  });

  it("valida colores hexadecimales", () => {
    expect(cleanColor("#FF4FA3", "#000000")).toBe("#ff4fa3");
    expect(cleanColor(null, "#123456")).toBe("#123456");
    expect(() => cleanColor("rosa", "#000000")).toThrow();
    expect(() => cleanColor("red;}", "#000000")).toThrow();
  });

  it("ajusta líneas y tamaño: texto corto grande, largo más chico, sin salirse", () => {
    const short = layoutText("Hola");
    const long = layoutText("Esta es una frase bastante larga para comprobar que el texto se reparte en varias líneas");
    expect(short.size).toBeGreaterThan(long.size);
    expect(long.lines.length).toBeGreaterThan(1);
    expect(wrapText("supercalifragilistico", 8).every((l) => l.length <= 8)).toBe(true);
  });

  it("genera un WebP 512x512 con transparencia y texto visible", async () => {
    const { bytes } = await textSticker("Hola YuiApi", null, null);
    const meta = await sharp(Buffer.from(bytes)).metadata();
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["webp", 512, 512, true]);
    expect(bytes.length).toBeLessThanOrEqual(100 * 1024);
    const { data } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 200) opaque++;
    expect(opaque).toBeGreaterThan(2000);
    expect(opaque).toBeLessThan(512 * 512 * 0.7);
    expect(data[3]).toBe(0); // la esquina es transparente
  });
});

describe("quitar fondo liso", () => {
  // 100x100 blanco, cuadrado rojo 40x40 con hueco blanco 10x10 adentro.
  async function sample(bg = "#ffffff") {
    const base = await sharp({ create: { width: 100, height: 100, channels: 3, background: bg } })
      .composite([
        { input: await sharp({ create: { width: 40, height: 40, channels: 3, background: "#e11d48" } }).png().toBuffer(), left: 30, top: 30 },
        { input: await sharp({ create: { width: 10, height: 10, channels: 3, background: bg } }).png().toBuffer(), left: 45, top: 45 },
      ])
      .png()
      .toBuffer();
    return new Uint8Array(base);
  }
  const alphaAt = async (png: Uint8Array, x: number, y: number) => {
    const { data, info } = await sharp(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return data[(y * info.width + x) * 4 + 3];
  };

  it("borra el fondo conectado y conserva el objeto y su hueco interior", async () => {
    const r = await removeBackground(await sample(), null);
    expect(await alphaAt(r.png, 2, 2)).toBe(0);
    expect(await alphaAt(r.png, 97, 97)).toBe(0);
    expect(await alphaAt(r.png, 35, 35)).toBe(255);
    expect(await alphaAt(r.png, 50, 50)).toBe(255); // hueco blanco dentro del objeto
    expect(r.background).toBe("#ffffff");
    expect(r.removedPct).toBeGreaterThan(70);
  });

  it("funciona con fondos de color", async () => {
    const r = await removeBackground(await sample("#22c55e"), "30");
    expect(await alphaAt(r.png, 2, 2)).toBe(0);
    expect(r.background).toBe("#22c55e");
  });

  it("rechaza fondos que no son lisos y vacíos", async () => {
    const split = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#ffffff" } })
      .composite([{ input: await sharp({ create: { width: 50, height: 100, channels: 3, background: "#000000" } }).png().toBuffer(), left: 0, top: 0 }])
      .png()
      .toBuffer();
    expect((await fails(removeBackground(new Uint8Array(split), null))).status).toBe(422);
    expect((await fails(removeBackground(new Uint8Array(0), null))).status).toBe(400);
    expect((await fails(removeBackground(new TextEncoder().encode("hola"), null))).status).toBe(400);
  });

  it("si solo coinciden las esquinas no hay fondo que quitar (422)", async () => {
    const red = await sharp({ create: { width: 60, height: 60, channels: 3, background: "#e11d48" } })
      .composite([
        { input: await sharp({ create: { width: 3, height: 3, channels: 3, background: "#ffffff" } }).png().toBuffer(), left: 0, top: 0 },
        { input: await sharp({ create: { width: 3, height: 3, channels: 3, background: "#ffffff" } }).png().toBuffer(), left: 57, top: 0 },
        { input: await sharp({ create: { width: 3, height: 3, channels: 3, background: "#ffffff" } }).png().toBuffer(), left: 0, top: 57 },
        { input: await sharp({ create: { width: 3, height: 3, channels: 3, background: "#ffffff" } }).png().toBuffer(), left: 57, top: 57 },
      ])
      .png()
      .toBuffer();
    expect((await fails(removeBackground(new Uint8Array(red), null))).status).toBe(422);
  });
});
