import JSZip from "jszip";

export type ZipSticker = { bytes: Uint8Array; emojis: string[] };

export type PackZipInput = {
  title: string;
  publisher: string;
  stickers: ZipSticker[];
  tray: Uint8Array;
  credits: string;
  animated: boolean;
};

export function slugify(text: string): string {
  const s = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "paquete";
}

const README = `COMO USAR ESTE PAQUETE
======================
Este ZIP contiene tus stickers ya listos para WhatsApp: archivos WebP de 512x512 con
fondo transparente, un icono de paquete de 96x96 (tray.png) y pack.json con los emojis.

WhatsApp no deja instalar paquetes desde una pagina web. Para agregarlos:
1. Descomprime el ZIP en tu telefono.
2. Abre una app creadora de paquetes de stickers (por ejemplo "Sticker Maker" en Android
   o iPhone) e importa los archivos de la carpeta stickers/ junto con tray.png.
3. Desde esa app, usa "Agregar a WhatsApp".

CREDITOS.txt contiene la ficha de autoria. Es informativa y no constituye proteccion legal.
`;

/** Arma el ZIP descargable de un paquete: stickers, icono, pack.json, créditos e instrucciones. */
export async function buildPackZip(input: PackZipInput): Promise<Uint8Array> {
  const zip = new JSZip();
  const folder = zip.folder("stickers");
  if (!folder) throw new Error("No se pudo crear el ZIP.");

  const files = input.stickers.map((s, i) => ({
    name: `${String(i + 1).padStart(2, "0")}.webp`,
    emojis: s.emojis,
    bytes: s.bytes,
  }));
  for (const f of files) folder.file(f.name, f.bytes);

  zip.file("tray.png", input.tray);
  zip.file(
    "pack.json",
    JSON.stringify(
      {
        identifier: slugify(input.title),
        name: input.title,
        publisher: input.publisher,
        animated_sticker_pack: input.animated,
        tray_image_file: "tray.png",
        stickers: files.map((f) => ({ image_file: `stickers/${f.name}`, emojis: f.emojis })),
      },
      null,
      2,
    ),
  );
  zip.file("CREDITOS.txt", input.credits);
  zip.file("LEEME.txt", README);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
