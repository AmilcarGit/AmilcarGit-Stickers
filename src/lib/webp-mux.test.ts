import { describe, expect, it } from "vitest";
import { isAnimatedWebp, muxAnimatedWebp, parseStaticWebp, readFrameDurations } from "./webp-mux";

function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

function le32(n: number): number[] {
  return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
}

/** WebP sintético con un chunk VP8L (lossless) de cabecera mínima: 8x8 px. */
function fakeLosslessWebp(): Uint8Array {
  // VP8L: firma 0x2f + 4 bytes con (ancho-1) y (alto-1) de 14 bits cada uno
  const w = 8 - 1;
  const h = 8 - 1;
  const bits = (w & 0x3fff) | ((h & 0x3fff) << 14);
  const payload = [0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255, 1, 2, 3, 4, 5];
  const chunk = [...ascii("VP8L"), ...le32(payload.length), ...payload];
  const body = [...ascii("WEBP"), ...chunk];
  return new Uint8Array([...ascii("RIFF"), ...le32(body.length), ...body]);
}

describe("parseStaticWebp", () => {
  it("lee medidas y chunks de un WebP lossless", () => {
    const info = parseStaticWebp(fakeLosslessWebp());
    expect(info.width).toBe(8);
    expect(info.height).toBe(8);
    expect(info.frameChunks).toHaveLength(1);
  });

  it("rechaza archivos que no son WebP", () => {
    expect(() => parseStaticWebp(new Uint8Array(40))).toThrow();
  });
});

describe("muxAnimatedWebp", () => {
  const frames = [
    { data: fakeLosslessWebp(), durationMs: 80 },
    { data: fakeLosslessWebp(), durationMs: 120 },
    { data: fakeLosslessWebp(), durationMs: 80 },
  ];
  const out = muxAnimatedWebp(frames, 8, 8);

  it("genera un contenedor RIFF/WEBP animado", () => {
    expect(String.fromCharCode(...out.subarray(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...out.subarray(8, 12))).toBe("WEBP");
    expect(String.fromCharCode(...out.subarray(12, 16))).toBe("VP8X");
    expect(isAnimatedWebp(out)).toBe(true);
  });

  it("el tamaño RIFF coincide con el archivo", () => {
    const riffSize = out[4] | (out[5] << 8) | (out[6] << 16) | (out[7] << 24);
    expect(riffSize).toBe(out.length - 8);
  });

  it("conserva la duración de cada cuadro", () => {
    expect(readFrameDurations(out)).toEqual([80, 120, 80]);
  });

  it("un WebP estático no se detecta como animado", () => {
    expect(isAnimatedWebp(fakeLosslessWebp())).toBe(false);
  });
});
