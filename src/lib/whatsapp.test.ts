import { describe, expect, it } from "vitest";
import { WA, extractEmojis, validatePack, validateSticker } from "./whatsapp";

const okStatic = { mime: "image/webp", width: 512, height: 512, bytes: 40_000, animated: false, emojis: ["😀"] };

describe("validateSticker", () => {
  it("acepta un sticker estático válido", () => {
    expect(validateSticker(okStatic)).toEqual([]);
  });

  it("rechaza formato, medidas y peso incorrectos", () => {
    const codes = validateSticker({ ...okStatic, mime: "image/png", width: 500, bytes: WA.staticMaxBytes + 1 }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["format", "dimensions", "size"]));
  });

  it("aplica el límite de 500 KB a los animados", () => {
    const anim = { ...okStatic, animated: true, frameDurationsMs: [100, 100], bytes: 300_000 };
    expect(validateSticker(anim)).toEqual([]);
    const big = validateSticker({ ...anim, bytes: WA.animatedMaxBytes + 1 }).map((i) => i.code);
    expect(big).toContain("size");
  });

  it("valida cuadros y duración de animaciones", () => {
    expect(validateSticker({ ...okStatic, animated: true, frameDurationsMs: [100] }).map((i) => i.code)).toContain("frames");
    expect(validateSticker({ ...okStatic, animated: true, frameDurationsMs: [4, 100] }).map((i) => i.code)).toContain("frame-duration");
    expect(validateSticker({ ...okStatic, animated: true, frameDurationsMs: [6000, 6000] }).map((i) => i.code)).toContain("duration");
  });

  it("exige entre 1 y 3 emojis", () => {
    expect(validateSticker({ ...okStatic, emojis: [] }).map((i) => i.code)).toContain("emoji-min");
    expect(validateSticker({ ...okStatic, emojis: ["😀", "😂", "😍", "🔥"] }).map((i) => i.code)).toContain("emoji-max");
  });
});

describe("validatePack", () => {
  const s = { animated: false, emojis: ["😀"], bytes: 30_000 };

  it("exige entre 3 y 30 stickers", () => {
    expect(validatePack({ stickers: [s, s] }).map((i) => i.code)).toContain("pack-min");
    expect(validatePack({ stickers: Array(31).fill(s) }).map((i) => i.code)).toContain("pack-max");
    expect(validatePack({ stickers: [s, s, s] })).toEqual([]);
  });

  it("no permite mezclar estáticos y animados", () => {
    const codes = validatePack({ stickers: [s, s, { ...s, animated: true }] }).map((i) => i.code);
    expect(codes).toContain("pack-mixed");
  });

  it("valida el ícono del paquete", () => {
    const tray = { bytes: 60_000, width: 100, height: 96, mime: "image/jpeg" };
    const codes = validatePack({ stickers: [s, s, s], tray }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["tray-size", "tray-bytes", "tray-format"]));
  });
});

describe("extractEmojis", () => {
  it("extrae emojis y respeta el límite", () => {
    expect(extractEmojis("hola 😀 mundo 🔥")).toEqual(["😀", "🔥"]);
    expect(extractEmojis("😀😂😍🔥")).toHaveLength(3);
    expect(extractEmojis("sin emojis")).toEqual([]);
  });
});
