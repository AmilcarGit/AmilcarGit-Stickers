import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildPackZip, slugify } from "./pack-zip";

describe("slugify", () => {
  it("limpia acentos y símbolos", () => {
    expect(slugify("Mis Stickers Dóciles!!")).toBe("mis-stickers-dociles");
    expect(slugify("???")).toBe("paquete");
  });
});

describe("buildPackZip", () => {
  it("incluye stickers numerados, icono, pack.json, créditos e instrucciones", async () => {
    const bytes = await buildPackZip({
      title: "Gatos 3D",
      publisher: "Amilcar",
      animated: false,
      tray: new Uint8Array([1, 2, 3]),
      credits: "CREADOR: Amilcar",
      stickers: [
        { bytes: new Uint8Array([10]), emojis: ["😺"] },
        { bytes: new Uint8Array([11]), emojis: ["😸", "🐱"] },
        { bytes: new Uint8Array([12]), emojis: ["😻"] },
      ],
    });
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files);
    expect(names).toEqual(
      expect.arrayContaining(["stickers/01.webp", "stickers/02.webp", "stickers/03.webp", "tray.png", "pack.json", "CREDITOS.txt", "LEEME.txt"]),
    );
    const meta = JSON.parse(await zip.file("pack.json")!.async("string"));
    expect(meta.name).toBe("Gatos 3D");
    expect(meta.identifier).toBe("gatos-3d");
    expect(meta.stickers).toHaveLength(3);
    expect(meta.stickers[1]).toEqual({ image_file: "stickers/02.webp", emojis: ["😸", "🐱"] });
    expect(await zip.file("CREDITOS.txt")!.async("string")).toContain("Amilcar");
    expect(Array.from(await zip.file("stickers/02.webp")!.async("uint8array"))).toEqual([11]);
  });
});
