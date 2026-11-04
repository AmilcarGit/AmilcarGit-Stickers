/**
 * Requisitos de stickers de WhatsApp.
 * Fuente: README oficial WhatsApp/stickers (Android), verificado el 2026-11-03.
 * Si WhatsApp cambia sus límites, este es el único archivo que hay que actualizar.
 */
export const WA = {
  size: 512,
  staticMaxBytes: 100 * 1024,
  animatedMaxBytes: 500 * 1024,
  minFrameMs: 8,
  maxDurationMs: 10_000,
  traySize: 96,
  trayMaxBytes: 50 * 1024,
  minStickers: 3,
  maxStickers: 30,
  maxEmojis: 3,
} as const;

export type Issue = { code: string; message: string };

export type StickerCheckInput = {
  mime: string;
  width: number;
  height: number;
  bytes: number;
  animated: boolean;
  frameDurationsMs?: number[];
  emojis?: string[];
};

export function validateSticker(input: StickerCheckInput): Issue[] {
  const issues: Issue[] = [];
  if (input.mime !== "image/webp") {
    issues.push({ code: "format", message: "El sticker debe estar en formato WebP." });
  }
  if (input.width !== WA.size || input.height !== WA.size) {
    issues.push({
      code: "dimensions",
      message: `Debe medir exactamente ${WA.size}x${WA.size} px (mide ${input.width}x${input.height}).`,
    });
  }
  const maxBytes = input.animated ? WA.animatedMaxBytes : WA.staticMaxBytes;
  if (input.bytes > maxBytes) {
    issues.push({
      code: "size",
      message: `Pesa ${Math.round(input.bytes / 1024)} KB y el máximo es ${Math.round(maxBytes / 1024)} KB.`,
    });
  }
  if (input.animated) {
    const frames = input.frameDurationsMs ?? [];
    if (frames.length < 2) {
      issues.push({ code: "frames", message: "Un sticker animado necesita al menos 2 cuadros." });
    }
    if (frames.some((ms) => ms < WA.minFrameMs)) {
      issues.push({ code: "frame-duration", message: `Cada cuadro debe durar al menos ${WA.minFrameMs} ms.` });
    }
    const total = frames.reduce((a, b) => a + b, 0);
    if (total > WA.maxDurationMs) {
      issues.push({ code: "duration", message: "La animación no puede durar más de 10 segundos." });
    }
  }
  if (input.emojis) {
    if (input.emojis.length < 1) {
      issues.push({ code: "emoji-min", message: "Cada sticker necesita al menos 1 emoji." });
    }
    if (input.emojis.length > WA.maxEmojis) {
      issues.push({ code: "emoji-max", message: `Máximo ${WA.maxEmojis} emojis por sticker.` });
    }
  }
  return issues;
}

export type PackCheckInput = {
  stickers: { animated: boolean; emojis: string[]; bytes: number }[];
  tray?: { bytes: number; width: number; height: number; mime: string };
};

export function validatePack(input: PackCheckInput): Issue[] {
  const issues: Issue[] = [];
  const n = input.stickers.length;
  if (n < WA.minStickers) {
    issues.push({ code: "pack-min", message: `Un paquete necesita al menos ${WA.minStickers} stickers (tiene ${n}).` });
  }
  if (n > WA.maxStickers) {
    issues.push({ code: "pack-max", message: `Un paquete admite máximo ${WA.maxStickers} stickers (tiene ${n}).` });
  }
  const animatedCount = input.stickers.filter((s) => s.animated).length;
  if (animatedCount > 0 && animatedCount < n) {
    issues.push({
      code: "pack-mixed",
      message: "WhatsApp no permite mezclar stickers estáticos y animados en el mismo paquete.",
    });
  }
  input.stickers.forEach((s, i) => {
    if (s.emojis.length < 1 || s.emojis.length > WA.maxEmojis) {
      issues.push({ code: "pack-emoji", message: `El sticker ${i + 1} necesita entre 1 y ${WA.maxEmojis} emojis.` });
    }
    const max = s.animated ? WA.animatedMaxBytes : WA.staticMaxBytes;
    if (s.bytes > max) {
      issues.push({ code: "pack-size", message: `El sticker ${i + 1} supera el peso máximo permitido.` });
    }
  });
  if (input.tray) {
    const t = input.tray;
    if (t.width !== WA.traySize || t.height !== WA.traySize) {
      issues.push({ code: "tray-size", message: `El ícono del paquete debe medir ${WA.traySize}x${WA.traySize} px.` });
    }
    if (t.bytes > WA.trayMaxBytes) {
      issues.push({ code: "tray-bytes", message: "El ícono del paquete pesa más de 50 KB." });
    }
    if (t.mime !== "image/png" && t.mime !== "image/webp") {
      issues.push({ code: "tray-format", message: "El ícono del paquete debe ser PNG o WebP." });
    }
  }
  return issues;
}

/** Devuelve los emojis (gráficos) contenidos en un texto, máximo `limit`. */
export function extractEmojis(text: string, limit: number = WA.maxEmojis): string[] {
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const out: string[] = [];
  for (const { segment } of seg.segment(text)) {
    if (/\p{Extended_Pictographic}/u.test(segment)) {
      out.push(segment);
      if (out.length >= limit) break;
    }
  }
  return out;
}
