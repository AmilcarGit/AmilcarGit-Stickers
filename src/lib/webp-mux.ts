/**
 * Ensamblador de WebP animado.
 * Los navegadores solo saben codificar WebP estático (canvas.toBlob), así que
 * codificamos cada cuadro por separado y los unimos en un contenedor RIFF animado
 * (VP8X + ANIM + ANMF) siguiendo la especificación del contenedor WebP.
 */

export type MuxFrame = { data: Uint8Array; durationMs: number };

const FRAME_CHUNKS = new Set(["ALPH", "VP8 ", "VP8L"]);

function fourcc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function writeU24(out: Uint8Array, offset: number, value: number) {
  out[offset] = value & 0xff;
  out[offset + 1] = (value >> 8) & 0xff;
  out[offset + 2] = (value >> 16) & 0xff;
}

function writeU32(out: Uint8Array, offset: number, value: number) {
  writeU24(out, offset, value);
  out[offset + 3] = (value >>> 24) & 0xff;
}

function writeFourcc(out: Uint8Array, offset: number, tag: string) {
  for (let i = 0; i < 4; i++) out[offset + i] = tag.charCodeAt(i);
}

export type WebpInfo = { width: number; height: number; frameChunks: Uint8Array[] };

/** Lee un WebP estático y devuelve sus chunks de imagen (ALPH, VP8, VP8L) y medidas. */
export function parseStaticWebp(bytes: Uint8Array): WebpInfo {
  if (bytes.length < 20 || fourcc(bytes, 0) !== "RIFF" || fourcc(bytes, 8) !== "WEBP") {
    throw new Error("El archivo no es un WebP válido.");
  }
  let width = 0;
  let height = 0;
  const frameChunks: Uint8Array[] = [];
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const tag = fourcc(bytes, pos);
    const size = u32(bytes, pos + 4);
    const padded = size + (size & 1);
    const end = pos + 8 + padded;
    if (end > bytes.length + 1) throw new Error("WebP truncado o corrupto.");
    const payload = pos + 8;
    if (tag === "VP8X") {
      width = 1 + (bytes[payload + 4] | (bytes[payload + 5] << 8) | (bytes[payload + 6] << 16));
      height = 1 + (bytes[payload + 7] | (bytes[payload + 8] << 8) | (bytes[payload + 9] << 16));
    } else if (tag === "VP8 ") {
      width = width || (bytes[payload + 6] | (bytes[payload + 7] << 8)) & 0x3fff;
      height = height || (bytes[payload + 8] | (bytes[payload + 9] << 8)) & 0x3fff;
    } else if (tag === "VP8L") {
      const b = bytes.subarray(payload + 1, payload + 5);
      width = width || 1 + (b[0] | ((b[1] & 0x3f) << 8));
      height = height || 1 + (((b[1] & 0xc0) >> 6) | (b[2] << 2) | ((b[3] & 0x0f) << 10));
    }
    if (FRAME_CHUNKS.has(tag)) {
      const chunk = new Uint8Array(8 + padded);
      chunk.set(bytes.subarray(pos, pos + 8 + size));
      frameChunks.push(chunk);
    }
    pos = end;
  }
  if (frameChunks.length === 0) throw new Error("El WebP no contiene datos de imagen.");
  return { width, height, frameChunks };
}

/** Une varios WebP estáticos en un único WebP animado en bucle infinito. */
export function muxAnimatedWebp(frames: MuxFrame[], width: number, height: number, loopCount = 0): Uint8Array {
  if (frames.length === 0) throw new Error("Se necesita al menos un cuadro.");

  const anmfChunks: Uint8Array[] = frames.map((frame) => {
    const info = parseStaticWebp(frame.data);
    const dataLength = info.frameChunks.reduce((n, c) => n + c.length, 0);
    const payloadSize = 16 + dataLength;
    const chunk = new Uint8Array(8 + payloadSize);
    writeFourcc(chunk, 0, "ANMF");
    writeU32(chunk, 4, payloadSize);
    // X, Y (en unidades de 2 px) = 0; ancho/alto - 1; duración; flags
    writeU24(chunk, 8, 0);
    writeU24(chunk, 11, 0);
    writeU24(chunk, 14, width - 1);
    writeU24(chunk, 17, height - 1);
    writeU24(chunk, 20, Math.max(0, Math.round(frame.durationMs)));
    chunk[23] = 0x01; // liberar al fondo (transparente) y mezclar con alfa
    let offset = 24;
    for (const c of info.frameChunks) {
      chunk.set(c, offset);
      offset += c.length;
    }
    return chunk;
  });

  const vp8x = new Uint8Array(18);
  writeFourcc(vp8x, 0, "VP8X");
  writeU32(vp8x, 4, 10);
  vp8x[8] = 0x12; // animación + alfa
  writeU24(vp8x, 12, width - 1);
  writeU24(vp8x, 15, height - 1);

  const anim = new Uint8Array(14);
  writeFourcc(anim, 0, "ANIM");
  writeU32(anim, 4, 6);
  // color de fondo (0,0,0,0) y número de repeticiones (0 = infinito)
  anim[12] = loopCount & 0xff;
  anim[13] = (loopCount >> 8) & 0xff;

  const bodySize = 4 + vp8x.length + anim.length + anmfChunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(8 + bodySize);
  writeFourcc(out, 0, "RIFF");
  writeU32(out, 4, bodySize);
  writeFourcc(out, 8, "WEBP");
  let pos = 12;
  out.set(vp8x, pos);
  pos += vp8x.length;
  out.set(anim, pos);
  pos += anim.length;
  for (const c of anmfChunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/** Duración (ms) de cada cuadro de un WebP animado ya ensamblado. */
export function readFrameDurations(bytes: Uint8Array): number[] {
  const durations: number[] = [];
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const tag = fourcc(bytes, pos);
    const size = u32(bytes, pos + 4);
    if (tag === "ANMF") {
      durations.push(bytes[pos + 8 + 12] | (bytes[pos + 8 + 13] << 8) | (bytes[pos + 8 + 14] << 16));
    }
    pos += 8 + size + (size & 1);
  }
  return durations;
}

export function isAnimatedWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 21 || fourcc(bytes, 0) !== "RIFF" || fourcc(bytes, 8) !== "WEBP") return false;
  return fourcc(bytes, 12) === "VP8X" && (bytes[20] & 0x02) !== 0;
}
