import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "./errors";
import { MAX_INPUT_BYTES, convertToSticker } from "./sticker-convert";

/* ------------------------------ Texto a sticker ------------------------------ */

const SIZE = 512;
const BOX = 456;
export const MAX_TEXT = 120;
const FONT_FAMILY = "DejaVu Sans";
let fontsReady = false;

/**
 * En Vercel no hay fuentes del sistema: apuntamos fontconfig a la fuente incluida en el repositorio
 * (assets/fonts). Debe ejecutarse antes del primer renderizado SVG del proceso.
 */
export function ensureFonts(): void {
  if (fontsReady) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  const tmp = os.tmpdir();
  mkdirSync(tmp, { recursive: true });
  const conf = path.join(tmp, "yuiapi-fonts.conf");
  writeFileSync(
    conf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${dir}</dir><cachedir>${path.join(tmp, "yuiapi-fc-cache")}</cachedir></fontconfig>`,
  );
  process.env.FONTCONFIG_FILE = conf;
  fontsReady = true;
}

/** Solo caracteres que la fuente incluida dibuja bien (latín, acentos, puntuación). El resto se descarta: sin emojis. */
export function cleanStickerText(raw: string | null): string {
  const text = (raw ?? "")
    .normalize("NFC")
    .replace(/[^ -~¡-ɏ‘-‟…€\n]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
  if (!text) throw new AppError(400, "Escribe un texto con letras, números o signos (los emojis no se dibujan).");
  return text;
}

export function cleanColor(raw: string | null, fallback: string): string {
  if (raw === null || raw === "") return fallback;
  const hex = raw.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) throw new AppError(400, "Los colores van en hexadecimal de 6 dígitos, por ejemplo ff4fa3.");
  return `#${hex.toLowerCase()}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Parte el texto en líneas de hasta `max` caracteres, cortando palabras demasiado largas. */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (let word of text.split(" ")) {
    while (word.length > max) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(word.slice(0, max));
      word = word.slice(max);
    }
    if (!word) continue;
    if (!line) line = word;
    else if ((line + " " + word).length <= max) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Elige el tamaño de letra más grande que quepa en el cuadro del sticker. */
export function layoutText(text: string): { size: number; lines: string[] } {
  for (let size = 168; size >= 28; size -= 4) {
    const max = Math.max(1, Math.floor(BOX / (size * 0.7)));
    const lines = wrapText(text, max);
    if (lines.length * size * 1.18 <= BOX) return { size, lines };
  }
  return { size: 28, lines: wrapText(text, Math.floor(BOX / (28 * 0.7))).slice(0, 12) };
}

export function textSvg(text: string, color: string, outline: string): string {
  const { size, lines } = layoutText(text);
  const lh = size * 1.18;
  const top = SIZE / 2 - (lines.length * lh) / 2 + size * 0.86;
  const stroke = Math.max(4, Math.round(size * 0.14));
  const body = lines
    .map((l, i) => `<text x="${SIZE / 2}" y="${(top + i * lh).toFixed(1)}" text-anchor="middle">${esc(l)}</text>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<g font-family="${FONT_FAMILY}" font-weight="bold" font-size="${size}" fill="${color}" stroke="${outline}" stroke-width="${stroke}" stroke-linejoin="round" paint-order="stroke fill">${body}</g></svg>`
  );
}

/** Crea un sticker WebP 512x512 transparente solo con texto. */
export async function textSticker(textRaw: string | null, colorRaw: string | null, outlineRaw: string | null): Promise<{ bytes: Uint8Array; lines: number; fontSize: number }> {
  const text = cleanStickerText(textRaw);
  const color = cleanColor(colorRaw, "#ff4fa3");
  const outline = cleanColor(outlineRaw, "#ffffff");
  ensureFonts();
  let png: Buffer;
  try {
    png = await sharp(Buffer.from(textSvg(text, color, outline)), { density: 72 }).png().toBuffer();
  } catch {
    throw new AppError(500, "No se pudo dibujar el texto.");
  }
  const out = await convertToSticker(new Uint8Array(png), { fit: "contain", quality: 85 });
  const { size, lines } = layoutText(text);
  return { bytes: out.bytes, lines: lines.length, fontSize: size };
}

/* ------------------------------ Quitar fondo liso ------------------------------ */

const WORK_MAX = 1024;

export type RemoveBgResult = { png: Uint8Array; removedPct: number; background: string };

/**
 * Quita un fondo de color liso: toma el color de las esquinas y borra, desde los bordes, todo lo
 * conectado que se le parezca. NO es inteligencia artificial: con fondos con degradados, fotos o
 * sombras no funciona bien. Lo de adentro del objeto con el mismo color se conserva.
 */
export async function removeBackground(input: Uint8Array, toleranceRaw: string | null): Promise<RemoveBgResult> {
  if (input.length === 0) throw new AppError(400, "No se recibió ninguna imagen.");
  if (input.length > MAX_INPUT_BYTES) throw new AppError(413, "La imagen pesa más de 5 MB.");
  const t = Number.parseInt(toleranceRaw ?? "", 10);
  const tol = Number.isFinite(t) ? Math.min(120, Math.max(5, t)) : 40;

  let raw: { data: Buffer; info: sharp.OutputInfo };
  try {
    raw = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(WORK_MAX, WORK_MAX, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError(400, "El archivo no es una imagen válida (usa PNG, JPG, WebP o GIF).");
  }
  const { data, info } = raw;
  const w = info.width;
  const h = info.height;
  const px = (x: number, y: number) => (y * w + x) * 4;

  // Color de fondo: promedio de bloques 3x3 en las cuatro esquinas; deben parecerse entre sí.
  const corners: [number, number, number][] = [];
  for (const [cx, cy] of [[0, 0], [w - 3, 0], [0, h - 3], [w - 3, h - 3]]) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const i = px(Math.max(0, cx) + dx, Math.max(0, cy) + dy);
      if (i + 2 < data.length) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    }
    corners.push([r / n, g / n, b / n]);
  }
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const bg: [number, number, number] = [
    corners.reduce((s, c) => s + c[0], 0) / 4,
    corners.reduce((s, c) => s + c[1], 0) / 4,
    corners.reduce((s, c) => s + c[2], 0) / 4,
  ];
  if (corners.some((c) => dist(c, bg) > tol * 1.5)) {
    throw new AppError(422, "El fondo no es liso (las esquinas tienen colores distintos). Usa una imagen con fondo de un solo color.");
  }

  const isBg = (x: number, y: number): boolean => {
    const i = px(x, y);
    if (data[i + 3] < 16) return true;
    return Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]) <= tol;
  };

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const k = y * w + x;
    if (seen[k] || !isBg(x, y)) return;
    seen[k] = 1;
    stack.push(k);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w;
    const y = (k - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  let removed = 0;
  for (let k = 0; k < seen.length; k++) if (seen[k]) { data[k * 4 + 3] = 0; removed++; }
  const removedPct = Math.round((removed / (w * h)) * 1000) / 10;
  if (removedPct < 2) throw new AppError(422, "No se detectó un fondo liso para quitar. Prueba subir la tolerancia (tolerance).");

  // Borde suave: píxeles pegados al fondo y casi del mismo color pierden algo de opacidad.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (seen[k]) continue;
    const near = (x > 0 && seen[k - 1]) || (x < w - 1 && seen[k + 1]) || (y > 0 && seen[k - w]) || (y < h - 1 && seen[k + w]);
    if (!near) continue;
    const i = k * 4;
    const d = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
    if (d < tol * 1.8) data[i + 3] = Math.round(data[i + 3] * Math.min(1, Math.max(0.35, (d - tol) / (tol * 0.8))));
  }

  const png = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const hex = bg.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  return { png: new Uint8Array(png), removedPct, background: `#${hex}` };
}
