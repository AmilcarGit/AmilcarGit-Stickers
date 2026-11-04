import { applyFilter, removeBackground, type FilterId } from "./image-ops";

export const CANVAS = 512;

/* ------------------------------- Tipos ------------------------------- */

export type AnimId = "none" | "bounce" | "pulse" | "wiggle" | "spin" | "float" | "blink" | "shake";

export const ANIMS: { id: AnimId; label: string }[] = [
  { id: "none", label: "Sin animación" },
  { id: "bounce", label: "Rebote" },
  { id: "pulse", label: "Latido" },
  { id: "wiggle", label: "Balanceo" },
  { id: "spin", label: "Giro" },
  { id: "float", label: "Flotar" },
  { id: "blink", label: "Parpadeo" },
  { id: "shake", label: "Temblor" },
];

export type Pt = { x: number; y: number };

type Base = {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number; // radianes
  opacity: number;
  anim: AnimId;
};

export type Crop = { l: number; t: number; r: number; b: number }; // fracciones 0..0.9

export type ImageEl = Base & {
  type: "image";
  srcId: string;
  src: string;
  w: number;
  h: number;
  removeBg: boolean;
  tolerance: number;
  filter: FilterId;
  crop: Crop;
};
export type TextEl = Base & { type: "text"; text: string; color: string; stroke: string; size: number; bold: boolean };
export type EmojiEl = Base & { type: "emoji"; char: string; size: number };
export type DrawEl = Base & { type: "draw"; points: Pt[]; color: string; width: number };
export type El = ImageEl | TextEl | EmojiEl | DrawEl;

export type SceneStyle = {
  outline: boolean;
  outlineWidth: number;
  shadow: boolean;
  depth: number;
  light: boolean;
};

export type Scene = { elements: El[]; style: SceneStyle; durationMs: number };

export const STYLE_PRESETS: { id: string; label: string; style: SceneStyle }[] = [
  { id: "flat", label: "Plano", style: { outline: false, outlineWidth: 8, shadow: false, depth: 0, light: false } },
  { id: "cartoon", label: "Caricatura", style: { outline: true, outlineWidth: 10, shadow: true, depth: 0, light: false } },
  { id: "3d", label: "3D", style: { outline: true, outlineWidth: 8, shadow: true, depth: 10, light: true } },
  { id: "realistic", label: "Realista", style: { outline: true, outlineWidth: 4, shadow: true, depth: 4, light: true } },
];

export const DEFAULT_STYLE: SceneStyle = STYLE_PRESETS[1].style;

export function emptyScene(): Scene {
  return { elements: [], style: { ...DEFAULT_STYLE }, durationMs: 1500 };
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const hasAnimation = (scene: Scene): boolean => scene.elements.some((e) => e.anim !== "none");

/* --------------------------- Lectura segura de proyectos --------------------------- */

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string";

function isBase(o: Record<string, unknown>): boolean {
  return (
    str(o.id) &&
    num(o.x) &&
    num(o.y) &&
    num(o.scale) &&
    o.scale > 0 &&
    num(o.rotation) &&
    num(o.opacity) &&
    str(o.anim) &&
    ANIMS.some((a) => a.id === o.anim)
  );
}

function isElement(v: unknown): v is El {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!isBase(o)) return false;
  switch (o.type) {
    case "image": {
      const c = o.crop as Record<string, unknown> | undefined;
      return (
        str(o.srcId) &&
        str(o.src) &&
        num(o.w) &&
        num(o.h) &&
        o.w > 0 &&
        o.h > 0 &&
        typeof o.removeBg === "boolean" &&
        num(o.tolerance) &&
        str(o.filter) &&
        !!c &&
        num(c.l) &&
        num(c.t) &&
        num(c.r) &&
        num(c.b) &&
        c.l + c.r < 0.95 &&
        c.t + c.b < 0.95
      );
    }
    case "text":
      return str(o.text) && str(o.color) && str(o.stroke) && num(o.size) && typeof o.bold === "boolean";
    case "emoji":
      return str(o.char) && num(o.size);
    case "draw":
      return str(o.color) && num(o.width) && Array.isArray(o.points) && o.points.every((p) => !!p && num((p as Pt).x) && num((p as Pt).y));
    default:
      return false;
  }
}

/** Convierte el JSON guardado en una escena válida; descarta elementos dañados. Null si no es una escena. */
export function parseScene(json: string): Scene | null {
  try {
    const raw = JSON.parse(json) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.elements)) return null;
    const s = (raw.style ?? {}) as Record<string, unknown>;
    const style: SceneStyle = {
      outline: typeof s.outline === "boolean" ? s.outline : DEFAULT_STYLE.outline,
      outlineWidth: num(s.outlineWidth) ? Math.min(24, Math.max(0, s.outlineWidth)) : DEFAULT_STYLE.outlineWidth,
      shadow: typeof s.shadow === "boolean" ? s.shadow : DEFAULT_STYLE.shadow,
      depth: num(s.depth) ? Math.min(30, Math.max(0, s.depth)) : DEFAULT_STYLE.depth,
      light: typeof s.light === "boolean" ? s.light : DEFAULT_STYLE.light,
    };
    return {
      elements: raw.elements.filter(isElement),
      style,
      durationMs: num(raw.durationMs) ? Math.min(5000, Math.max(500, raw.durationMs)) : 1500,
    };
  } catch {
    return null;
  }
}

/* --------------------------- Animaciones en bucle --------------------------- */

export type AnimTransform = { dx: number; dy: number; scale: number; rot: number; alpha: number };

const TAU = Math.PI * 2;

/** `t` va de 0 a 1 y todas las animaciones son periódicas, así el bucle no da saltos. */
export function animTransform(anim: AnimId, t: number): AnimTransform {
  const base: AnimTransform = { dx: 0, dy: 0, scale: 1, rot: 0, alpha: 1 };
  switch (anim) {
    case "bounce":
      base.dy = -Math.abs(Math.sin(TAU * t * 0.5)) * 36;
      base.scale = 1 + Math.abs(Math.cos(TAU * t * 0.5)) * 0.04;
      break;
    case "pulse":
      base.scale = 1 + Math.sin(TAU * t) * 0.1;
      break;
    case "wiggle":
      base.rot = Math.sin(TAU * t) * 0.16;
      break;
    case "spin":
      base.rot = TAU * t;
      break;
    case "float":
      base.dy = Math.sin(TAU * t) * 12;
      base.dx = Math.cos(TAU * t) * 6;
      break;
    case "blink":
      base.alpha = 0.55 + 0.45 * Math.abs(Math.cos(Math.PI * t));
      break;
    case "shake":
      base.dx = Math.sin(TAU * t * 4) * 7;
      break;
    default:
      break;
  }
  return base;
}

/* --------------------------- Imágenes y recorte --------------------------- */

export function imageSize(el: ImageEl): { w: number; h: number } {
  const w = Math.max(1, Math.round(el.w * (1 - el.crop.l - el.crop.r)));
  const h = Math.max(1, Math.round(el.h * (1 - el.crop.t - el.crop.b)));
  return { w, h };
}

function makeCanvas(w = CANVAS, h = CANVAS): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Guarda las imágenes cargadas y cachea el resultado de recortar / quitar fondo / filtrar. */
export class ImageStore {
  private images = new Map<string, HTMLImageElement>();
  private processed = new Map<string, HTMLCanvasElement>();

  has(srcId: string): boolean {
    return this.images.has(srcId);
  }

  async load(srcId: string, src: string): Promise<void> {
    if (this.images.has(srcId)) return;
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
      img.src = src;
    });
    this.images.set(srcId, img);
  }

  get(el: ImageEl): HTMLCanvasElement | null {
    const img = this.images.get(el.srcId);
    if (!img) return null;
    const c = el.crop;
    const key = `${el.srcId}|${el.removeBg ? el.tolerance : "x"}|${el.filter}|${c.l},${c.t},${c.r},${c.b}`;
    const hit = this.processed.get(key);
    if (hit) return hit;

    const { w, h } = imageSize(el);
    const out = makeCanvas(w, h);
    const ctx = out.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, c.l * el.w, c.t * el.h, w, h, 0, 0, w, h);
    if (el.removeBg || el.filter !== "none") {
      const data = ctx.getImageData(0, 0, w, h);
      if (el.removeBg) removeBackground(data.data, w, h, el.tolerance);
      if (el.filter !== "none") applyFilter(data.data, el.filter);
      ctx.putImageData(data, 0, 0);
    }
    if (this.processed.size > 24) this.processed.clear();
    this.processed.set(key, out);
    return out;
  }
}

/** Lee un archivo, lo reduce (máx. 640 px) y lo devuelve como data URL liviana. */
export async function importImageFile(file: File): Promise<{ src: string; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.src = url;
    });
    const max = 640;
    const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * ratio));
    const h = Math.max(1, Math.round(img.naturalHeight * ratio));
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Tu navegador no permite procesar imágenes.");
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    let transparent = false;
    for (let i = 3; i < px.length; i += 4 * 7) {
      if (px[i] < 250) {
        transparent = true;
        break;
      }
    }
    const src = transparent ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.86);
    return { src, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* --------------------------- Creación de elementos --------------------------- */

const baseEl = (x = CANVAS / 2, y = CANVAS / 2) => ({
  id: newId(),
  x,
  y,
  scale: 1,
  rotation: 0,
  opacity: 1,
  anim: "none" as AnimId,
});

export function makeImageEl(srcId: string, src: string, w: number, h: number): ImageEl {
  const fit = Math.min(1, 380 / Math.max(w, h));
  return {
    ...baseEl(),
    type: "image",
    srcId,
    src,
    w,
    h,
    scale: fit,
    removeBg: false,
    tolerance: 40,
    filter: "none",
    crop: { l: 0, t: 0, r: 0, b: 0 },
  };
}

export function makeTextEl(text = "Hola"): TextEl {
  return { ...baseEl(), type: "text", text, color: "#ffffff", stroke: "#2b1b5a", size: 84, bold: true };
}

export function makeEmojiEl(char: string): EmojiEl {
  return { ...baseEl(), type: "emoji", char, size: 200 };
}

export function makeDrawEl(points: Pt[], color: string, width: number): DrawEl | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    ...baseEl(cx, cy),
    type: "draw",
    color,
    width,
    points: points.map((p) => ({ x: p.x - cx, y: p.y - cy })),
  };
}

/* --------------------------- Medidas y selección --------------------------- */

const TEXT_FONT = '"Segoe UI","Helvetica Neue",Arial,sans-serif';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function textFont(el: TextEl): string {
  return `${el.bold ? 800 : 500} ${el.size}px ${TEXT_FONT}`;
}

export function measureEl(el: El, ctx: CanvasRenderingContext2D): { hw: number; hh: number } {
  switch (el.type) {
    case "image": {
      const s = imageSize(el);
      return { hw: s.w / 2, hh: s.h / 2 };
    }
    case "text": {
      ctx.save();
      ctx.font = textFont(el);
      const lines = el.text.split("\n");
      const w = Math.max(10, ...lines.map((l) => ctx.measureText(l).width));
      ctx.restore();
      return { hw: w / 2 + 6, hh: (lines.length * el.size * 1.2) / 2 };
    }
    case "emoji":
      return { hw: el.size * 0.6, hh: el.size * 0.6 };
    case "draw": {
      const mx = Math.max(4, ...el.points.map((p) => Math.abs(p.x)));
      const my = Math.max(4, ...el.points.map((p) => Math.abs(p.y)));
      return { hw: mx + el.width / 2, hh: my + el.width / 2 };
    }
  }
}

/** Devuelve el id del elemento más alto bajo el punto (x, y), o null. */
export function hitTest(scene: Scene, x: number, y: number, ctx: CanvasRenderingContext2D): string | null {
  for (let i = scene.elements.length - 1; i >= 0; i--) {
    const el = scene.elements[i];
    const dx = x - el.x;
    const dy = y - el.y;
    const cos = Math.cos(-el.rotation);
    const sin = Math.sin(-el.rotation);
    const lx = (dx * cos - dy * sin) / el.scale;
    const ly = (dx * sin + dy * cos) / el.scale;
    const { hw, hh } = measureEl(el, ctx);
    if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) return el.id;
  }
  return null;
}

/* --------------------------- Dibujo --------------------------- */

function drawElement(ctx: CanvasRenderingContext2D, el: El, t: number, store: ImageStore): void {
  const a = animTransform(el.anim, t);
  ctx.save();
  ctx.translate(el.x + a.dx, el.y + a.dy);
  ctx.rotate(el.rotation + a.rot);
  const s = el.scale * a.scale;
  ctx.scale(s, s);
  ctx.globalAlpha = Math.max(0, Math.min(1, el.opacity * a.alpha));

  switch (el.type) {
    case "image": {
      const cv = store.get(el);
      if (cv) ctx.drawImage(cv, -cv.width / 2, -cv.height / 2);
      break;
    }
    case "text": {
      ctx.font = textFont(el);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const lines = el.text.split("\n");
      const lh = el.size * 1.2;
      const top = (-(lines.length - 1) * lh) / 2;
      lines.forEach((line, i) => {
        const y = top + i * lh;
        if (el.stroke) {
          ctx.lineWidth = Math.max(2, el.size / 7);
          ctx.strokeStyle = el.stroke;
          ctx.strokeText(line, 0, y);
        }
        ctx.fillStyle = el.color;
        ctx.fillText(line, 0, y);
      });
      break;
    }
    case "emoji": {
      ctx.font = `${el.size}px ${EMOJI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(el.char, 0, el.size * 0.05);
      break;
    }
    case "draw": {
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      el.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      if (el.points.length === 1) ctx.lineTo(el.points[0].x + 0.01, el.points[0].y);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function clearCtx(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.shadowColor = "transparent";
  ctx.clearRect(0, 0, c.width, c.height);
  return ctx;
}

function tintInto(dst: HTMLCanvasElement, src: HTMLCanvasElement, color: string): void {
  const c = clearCtx(dst);
  c.drawImage(src, 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = color;
  c.fillRect(0, 0, dst.width, dst.height);
  c.globalCompositeOperation = "source-over";
}

/**
 * Compone la escena en un lienzo de 512x512 con fondo transparente:
 * elementos → extrusión 3D → luz → borde blanco → sombra.
 */
export class SceneRenderer {
  readonly store = new ImageStore();
  private art = makeCanvas();
  private body = makeCanvas();
  private sil = makeCanvas();
  private ring = makeCanvas();
  private hi = makeCanvas();

  render(out: CanvasRenderingContext2D, scene: Scene, t: number): void {
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.globalCompositeOperation = "source-over";
    out.globalAlpha = 1;
    out.shadowColor = "transparent";
    out.clearRect(0, 0, CANVAS, CANVAS);

    const a = clearCtx(this.art);
    for (const el of scene.elements) drawElement(a, el, t, this.store);

    const { style } = scene;
    const b = clearCtx(this.body);

    if (style.depth > 0) {
      tintInto(this.sil, this.art, "rgba(25,10,55,0.75)");
      for (let i = Math.round(style.depth); i >= 1; i--) b.drawImage(this.sil, i * 0.6, i * 0.85);
    }
    b.drawImage(this.art, 0, 0);

    if (style.light) {
      const h = clearCtx(this.hi);
      h.drawImage(this.art, 0, 0);
      h.globalCompositeOperation = "source-atop";
      const g = h.createLinearGradient(0, 0, CANVAS, CANVAS);
      g.addColorStop(0, "rgba(255,255,255,0.5)");
      g.addColorStop(0.45, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(0,0,0,0.32)");
      h.fillStyle = g;
      h.fillRect(0, 0, CANVAS, CANVAS);
      h.globalCompositeOperation = "source-over";
      b.drawImage(this.hi, 0, 0);
    }

    let ringReady = false;
    if (style.outline && style.outlineWidth > 0) {
      tintInto(this.sil, this.body, "#ffffff");
      const r = clearCtx(this.ring);
      const steps = style.outlineWidth > 8 ? 40 : 28;
      for (let k = 0; k < steps; k++) {
        const ang = (k / steps) * Math.PI * 2;
        r.drawImage(this.sil, Math.cos(ang) * style.outlineWidth, Math.sin(ang) * style.outlineWidth);
      }
      r.drawImage(this.sil, 0, 0);
      ringReady = true;
    }

    out.save();
    if (style.shadow) {
      out.shadowColor = "rgba(0,0,0,0.38)";
      out.shadowBlur = 12;
      out.shadowOffsetY = 6;
    }
    if (ringReady) {
      out.drawImage(this.ring, 0, 0);
      out.restore();
      out.drawImage(this.body, 0, 0);
    } else {
      out.drawImage(this.body, 0, 0);
      out.restore();
    }
  }
}

/** Marco de selección que se dibuja encima en el editor (no se exporta). */
export function drawSelection(ctx: CanvasRenderingContext2D, el: El): void {
  const { hw, hh } = measureEl(el, ctx);
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate(el.rotation);
  ctx.scale(el.scale, el.scale);
  ctx.setLineDash([6 / el.scale, 5 / el.scale]);
  ctx.lineWidth = 2 / el.scale;
  ctx.strokeStyle = "#a78bfa";
  ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
  ctx.restore();
}
