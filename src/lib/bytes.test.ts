import { describe, expect, it } from "vitest";
import { formatKB, isJpegBytes, isPngBytes, isWebpBytes } from "./bytes";

describe("detección por firma de archivo", () => {
  it("reconoce WebP, PNG y JPEG y rechaza el resto", () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(isWebpBytes(webp)).toBe(true);
    expect(isPngBytes(png)).toBe(true);
    expect(isJpegBytes(jpg)).toBe(true);
    expect(isWebpBytes(png)).toBe(false);
    expect(isPngBytes(new Uint8Array(20))).toBe(false);
  });
});

describe("formatKB", () => {
  it("formatea tamaños", () => {
    expect(formatKB(2048)).toBe("2.0 KB");
    expect(formatKB(51_200)).toBe("50 KB");
  });
});
