import { blobOf } from "./bytes";
import { CANVAS, SceneRenderer, hasAnimation, type Scene } from "./scene";
import { WA, validateSticker, type Issue } from "./whatsapp";
import { muxAnimatedWebp, readFrameDurations } from "./webp-mux";

export type ExportResult = {
  bytes: Uint8Array;
  animated: boolean;
  frameDurationsMs: number[];
  quality: number;
  fps: number;
  issues: Issue[];
};

export type ExportOptions = {
  /** Token de Firebase, solo se usa si el navegador no sabe codificar WebP (Safari/iPhone). */
  getToken?: () => Promise<string>;
  onProgress?: (fraction: number) => void;
};

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Codifica un lienzo a WebP con transparencia. Si el navegador devuelve otro formato
 * (Safari no codifica WebP en canvas), se envía como PNG al servidor, que lo convierte con sharp.
 */
export async function encodeWebp(canvas: HTMLCanvasElement, quality: number, opts: ExportOptions = {}): Promise<Uint8Array> {
  const blob = await canvasBlob(canvas, "image/webp", quality);
  if (blob && blob.type === "image/webp") return new Uint8Array(await blob.arrayBuffer());

  const png = await canvasBlob(canvas, "image/png");
  if (!png) throw new Error("No se pudo generar la imagen.");
  if (!opts.getToken) throw new Error("Tu navegador no puede crear WebP. Inicia sesión para usar el convertidor del servidor.");
  const token = await opts.getToken();
  const res = await fetch(`/api/webp?q=${Math.round(quality * 100)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
    body: png,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.error ?? "El servidor no pudo convertir el sticker a WebP.");
  }
  return new Uint8Array(await res.arrayBuffer());
}

const QUALITIES = [0.85, 0.7, 0.55, 0.4, 0.28];
const FPS_STEPS = [12, 10, 8];

/**
 * Exporta la escena como sticker de WhatsApp (512x512, fondo transparente).
 * Estático: sube la compresión hasta caber en 100 KB.
 * Animado: cuadros WebP unidos en un WebP animado en bucle; baja calidad y luego cuadros
 * por segundo hasta caber en 500 KB.
 */
export async function exportSticker(scene: Scene, renderer: SceneRenderer, opts: ExportOptions = {}): Promise<ExportResult> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS;
  canvas.height = CANVAS;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  if (!hasAnimation(scene)) {
    renderer.render(ctx, scene, 0);
    let bytes: Uint8Array = new Uint8Array(0);
    let used: number = QUALITIES[0];
    for (const q of QUALITIES) {
      used = q;
      bytes = await encodeWebp(canvas, q, opts);
      if (bytes.length <= WA.staticMaxBytes) break;
    }
    opts.onProgress?.(1);
    return {
      bytes,
      animated: false,
      frameDurationsMs: [],
      quality: used,
      fps: 0,
      issues: validateSticker({ mime: "image/webp", width: CANVAS, height: CANVAS, bytes: bytes.length, animated: false }),
    };
  }

  let best: ExportResult | null = null;
  const attempts: { fps: number; q: number }[] = [];
  for (const fps of FPS_STEPS) for (const q of QUALITIES.slice(0, 4)) attempts.push({ fps, q });
  const maxAttempts = 6;

  for (let a = 0; a < Math.min(attempts.length, maxAttempts); a++) {
    const { fps, q } = attempts[a];
    const count = Math.max(2, Math.round((scene.durationMs / 1000) * fps));
    const per = Math.max(WA.minFrameMs, Math.round(scene.durationMs / count));
    const frames: { data: Uint8Array; durationMs: number }[] = [];
    for (let i = 0; i < count; i++) {
      renderer.render(ctx, scene, i / count);
      frames.push({ data: await encodeWebp(canvas, q, opts), durationMs: per });
      opts.onProgress?.((a + (i + 1) / count) / Math.min(attempts.length, maxAttempts));
    }
    const bytes = muxAnimatedWebp(frames, CANVAS, CANVAS, 0);
    const durations = readFrameDurations(bytes);
    best = {
      bytes,
      animated: true,
      frameDurationsMs: durations,
      quality: q,
      fps,
      issues: validateSticker({
        mime: "image/webp",
        width: CANVAS,
        height: CANVAS,
        bytes: bytes.length,
        animated: true,
        frameDurationsMs: durations,
      }),
    };
    if (bytes.length <= WA.animatedMaxBytes) break;
  }
  opts.onProgress?.(1);
  return best as ExportResult;
}

/** Ícono del paquete: 96x96 PNG a partir de un sticker WebP. */
export async function makeTrayIcon(stickerBytes: Uint8Array): Promise<Uint8Array> {
  const bmp = await createImageBitmap(blobOf(stickerBytes, "image/webp"));
  const c = document.createElement("canvas");
  c.width = WA.traySize;
  c.height = WA.traySize;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const s = Math.min(WA.traySize / bmp.width, WA.traySize / bmp.height);
  const w = bmp.width * s;
  const h = bmp.height * s;
  ctx.drawImage(bmp, (WA.traySize - w) / 2, (WA.traySize - h) / 2, w, h);
  bmp.close();
  const blob = await canvasBlob(c, "image/png");
  if (!blob) throw new Error("No se pudo crear el ícono del paquete.");
  return new Uint8Array(await blob.arrayBuffer());
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
