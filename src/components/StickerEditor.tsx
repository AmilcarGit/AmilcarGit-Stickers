"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { LICENSES, type LicenseId, type Originality } from "@/lib/credits";
import { getProject, saveProject } from "@/lib/data";
import { addToDraft } from "@/lib/draft";
import { downloadBlob, exportSticker, type ExportResult } from "@/lib/export";
import { blobOf, formatKB } from "@/lib/bytes";
import { FILTERS, type FilterId } from "@/lib/image-ops";
import { History } from "@/lib/history";
import {
  ANIMS,
  CANVAS,
  STYLE_PRESETS,
  SceneRenderer,
  drawSelection,
  emptyScene,
  hasAnimation,
  hitTest,
  importImageFile,
  makeDrawEl,
  makeEmojiEl,
  makeImageEl,
  makeTextEl,
  newId,
  parseScene,
  type AnimId,
  type El,
  type Pt,
  type Scene,
  type SceneStyle,
} from "@/lib/scene";
import { clamp } from "@/lib/validators";
import { extractEmojis } from "@/lib/whatsapp";
import { Img } from "./Img";
import { useAuth, useToast } from "./Providers";

const EMOJI_PALETTE = [
  "😀", "😂", "😍", "😎", "🥳", "😭", "😡", "🤔", "😴", "🤯", "🥰", "😈",
  "👍", "👏", "🙏", "💪", "🔥", "✨", "💖", "💯", "🎉", "👑", "⭐", "🌈",
  "🐶", "🐱", "🦄", "🐸", "🍕", "🍔", "🍩", "☕", "⚽", "🎮", "🚀", "💎",
];

type Tab = "elements" | "style" | "anim" | "project" | "export";
const TABS: { id: Tab; label: string }[] = [
  { id: "elements", label: "Elementos" },
  { id: "style", label: "Estilo 3D" },
  { id: "anim", label: "Animación" },
  { id: "export", label: "Exportar" },
  { id: "project", label: "Proyecto" },
];

function elLabel(el: El): string {
  switch (el.type) {
    case "image":
      return "🖼️ Imagen";
    case "text":
      return `🔤 ${el.text.split("\n")[0].slice(0, 16) || "Texto"}`;
    case "emoji":
      return `${el.char} Emoji`;
    case "draw":
      return "✏️ Dibujo";
  }
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display?: string;
  onChange: (v: number) => void;
  onEnd: () => void;
}) {
  const id = `s-${props.label.replace(/\s+/g, "-")}`;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium">
          {props.label}
        </label>
        <span className="text-muted">{props.display ?? props.value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        onPointerUp={props.onEnd}
        onKeyUp={props.onEnd}
        onBlur={props.onEnd}
        onTouchEnd={props.onEnd}
      />
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm font-medium">
      {props.label}
      <input type="checkbox" className="h-6 w-6 accent-[rgb(var(--brand))]" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function StickerEditor() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const projectParam = params.get("project");

  const historyRef = useRef(new History<Scene>(emptyScene()));
  const rendererRef = useRef<SceneRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(true);
  const gestureRef = useRef<Scene | null>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; before: Scene } | null>(null);
  const strokeRef = useRef<Pt[] | null>(null);
  const playingRef = useRef(true);
  const loadedRef = useRef<string | null>(null);
  const selIdRef = useRef<string | null>(null);
  const [tick, force] = useReducer((n: number) => n + 1, 0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("elements");
  const [tool, setTool] = useState<"select" | "draw">("select");
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(14);
  const [playing, setPlaying] = useState(true);
  const [newText, setNewText] = useState("Hola");
  const [customEmoji, setCustomEmoji] = useState("");

  const [projectId, setProjectId] = useState<string | null>(null);
  const [name, setName] = useState("Mi sticker");
  const [originality, setOriginality] = useState<Originality>("original");
  const [license, setLicense] = useState<LicenseId>("all-rights-reserved");
  const [thirdPartyNote, setThirdPartyNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [emojiText, setEmojiText] = useState("😀");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<(ExportResult & { url: string }) | null>(null);

  // Copias en refs de valores que el bucle de dibujo lee sin reiniciarse.
  const drawColorRef = useRef(drawColor);
  const drawWidthRef = useRef(drawWidth);

  const hist = historyRef.current;
  const scene = hist.current;
  const selected = scene.elements.find((e) => e.id === selectedId) ?? null;

  const getRenderer = useCallback(() => {
    if (!rendererRef.current) rendererRef.current = new SceneRenderer();
    return rendererRef.current;
  }, []);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    dirtyRef.current = true;
  }, [tick, selectedId, tool, drawColor, drawWidth]);

  /* ---------------------------- Bucle de dibujo ---------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const renderer = getRenderer();
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const s = historyRef.current.current;
      const animating = playingRef.current && hasAnimation(s);
      if (animating || dirtyRef.current || strokeRef.current) {
        const t = animating ? ((now - start) % s.durationMs) / s.durationMs : 0;
        renderer.render(ctx, s, t);
        const sel = s.elements.find((e) => e.id === selIdRef.current);
        if (sel && !strokeRef.current) drawSelection(ctx, sel);
        const stroke = strokeRef.current;
        if (stroke && stroke.length > 0) {
          ctx.save();
          ctx.strokeStyle = drawColorRef.current;
          ctx.lineWidth = drawWidthRef.current;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          stroke.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.01, stroke[0].y);
          ctx.stroke();
          ctx.restore();
        }
        dirtyRef.current = false;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [getRenderer]);

  useEffect(() => {
    selIdRef.current = selectedId;
    drawColorRef.current = drawColor;
    drawWidthRef.current = drawWidth;
  }, [selectedId, drawColor, drawWidth]);

  /* ---------------------------- Cargar proyecto ---------------------------- */

  useEffect(() => {
    if (!projectParam || loadedRef.current === projectParam) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await getProject(projectParam);
        if (!p || cancelled) {
          if (!p) toast("No se encontró ese proyecto.", "error");
          return;
        }
        const parsed = parseScene(p.sceneJson);
        if (!parsed) {
          toast("El proyecto está dañado y no se pudo abrir.", "error");
          return;
        }
        const renderer = getRenderer();
        await Promise.all(parsed.elements.map((el) => (el.type === "image" ? renderer.store.load(el.srcId, el.src) : Promise.resolve())));
        if (cancelled) return;
        hist.reset(parsed);
        loadedRef.current = p.id;
        setProjectId(p.id);
        setName(p.name);
        setOriginality(p.originality);
        setLicense(p.license);
        setThirdPartyNote(p.thirdPartyNote);
        setSelectedId(null);
        force();
      } catch {
        toast("No se pudo abrir el proyecto.", "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectParam, getRenderer, hist, toast]);

  /* ---------------------------- Edición de escena ---------------------------- */

  const commit = useCallback(
    (next: Scene) => {
      hist.push(next);
      force();
    },
    [hist],
  );

  const live = useCallback(
    (next: Scene) => {
      if (!gestureRef.current) gestureRef.current = hist.current;
      hist.replace(next);
      force();
    },
    [hist],
  );

  const endGesture = useCallback(() => {
    if (gestureRef.current) {
      hist.commitFrom(gestureRef.current);
      gestureRef.current = null;
      force();
    }
  }, [hist]);

  const mapEl = (id: string, patch: Partial<El>): Scene => ({
    ...hist.current,
    elements: hist.current.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as unknown as El) : e)),
  });

  const patch = (id: string, p: Partial<El>) => commit(mapEl(id, p));
  const patchLive = (id: string, p: Partial<El>) => live(mapEl(id, p));

  const setStyle = (style: Partial<SceneStyle>, liveUpdate = false) => {
    const next = { ...hist.current, style: { ...hist.current.style, ...style } };
    if (liveUpdate) live(next);
    else commit(next);
  };

  const addElement = (el: El) => {
    commit({ ...hist.current, elements: [...hist.current.elements, el] });
    setSelectedId(el.id);
    setTool("select");
  };

  function removeSelected() {
    if (!selectedId) return;
    commit({ ...hist.current, elements: hist.current.elements.filter((e) => e.id !== selectedId) });
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...selected, id: newId(), x: selected.x + 24, y: selected.y + 24 } as unknown as El;
    addElement(copy);
  }

  function moveLayer(dir: -1 | 1) {
    if (!selectedId) return;
    const list = [...hist.current.elements];
    const i = list.findIndex((e) => e.id === selectedId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit({ ...hist.current, elements: list });
  }

  function undo() {
    hist.undo();
    force();
  }
  function redo() {
    hist.redo();
    force();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) historyRef.current.redo();
        else historyRef.current.undo();
        force();
      } else if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        historyRef.current.redo();
        force();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && selIdRef.current) {
        e.preventDefault();
        const s = historyRef.current.current;
        historyRef.current.push({ ...s, elements: s.elements.filter((x) => x.id !== selIdRef.current) });
        setSelectedId(null);
        force();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------------------- Imágenes ---------------------------- */

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (scene.elements.filter((x) => x.type === "image").length >= 6) {
      toast("Máximo 6 imágenes por sticker.", "error");
      return;
    }
    try {
      const img = await importImageFile(file);
      const srcId = newId();
      await getRenderer().store.load(srcId, img.src);
      addElement(makeImageEl(srcId, img.src, img.w, img.h));
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo abrir la imagen.", "error");
    }
  }

  /* ---------------------------- Puntero sobre el lienzo ---------------------------- */

  function toCanvas(e: ReactPointerEvent<HTMLCanvasElement>): Pt {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * CANVAS) / rect.width, y: ((e.clientY - rect.top) * CANVAS) / rect.height };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    if (tool === "draw") {
      strokeRef.current = [p];
      return;
    }
    const ctx = e.currentTarget.getContext("2d") as CanvasRenderingContext2D;
    const id = hitTest(scene, p.x, p.y, ctx);
    setSelectedId(id);
    const el = scene.elements.find((x) => x.id === id);
    if (el) dragRef.current = { id: el.id, sx: p.x, sy: p.y, ox: el.x, oy: el.y, before: scene };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const p = toCanvas(e);
    if (strokeRef.current) {
      const last = strokeRef.current[strokeRef.current.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 2) strokeRef.current.push(p);
      return;
    }
    const d = dragRef.current;
    if (d) {
      hist.replace({
        ...hist.current,
        elements: hist.current.elements.map((x) => (x.id === d.id ? { ...x, x: clamp(d.ox + p.x - d.sx, -100, CANVAS + 100), y: clamp(d.oy + p.y - d.sy, -100, CANVAS + 100) } : x)),
      });
      force();
    }
  }

  function onPointerUp() {
    if (strokeRef.current) {
      const el = makeDrawEl(strokeRef.current, drawColor, drawWidth);
      strokeRef.current = null;
      if (el) addElementKeepTool(el);
      return;
    }
    const d = dragRef.current;
    if (d) {
      hist.commitFrom(d.before);
      dragRef.current = null;
      force();
    }
  }

  function addElementKeepTool(el: El) {
    commit({ ...hist.current, elements: [...hist.current.elements, el] });
    setSelectedId(el.id);
  }

  /* ---------------------------- Proyecto ---------------------------- */

  function makeThumb(): string {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const full = document.createElement("canvas");
    full.width = CANVAS;
    full.height = CANVAS;
    getRenderer().render(full.getContext("2d") as CanvasRenderingContext2D, hist.current, 0);
    (c.getContext("2d") as CanvasRenderingContext2D).drawImage(full, 0, 0, 128, 128);
    return c.toDataURL("image/webp", 0.7);
  }

  async function save() {
    if (!user) return;
    if (scene.elements.length === 0) return toast("Agrega algo al sticker antes de guardar.", "info");
    setSaving(true);
    try {
      const id = await saveProject(projectId, {
        name: name.trim().slice(0, 80) || "Mi sticker",
        thumb: makeThumb(),
        sceneJson: JSON.stringify(hist.current),
        originality,
        license,
        thirdPartyNote: thirdPartyNote.slice(0, 500),
      });
      loadedRef.current = id;
      setProjectId(id);
      if (!projectParam) router.replace(`/editor?project=${id}`);
      toast("Proyecto guardado.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar el proyecto.", "error");
    } finally {
      setSaving(false);
    }
  }

  function newProject() {
    if (scene.elements.length > 0 && !confirm("¿Empezar uno nuevo? Los cambios sin guardar se perderán.")) return;
    hist.reset(emptyScene());
    loadedRef.current = null;
    setProjectId(null);
    setName("Mi sticker");
    setSelectedId(null);
    setResult(null);
    router.replace("/editor");
    force();
  }

  /* ---------------------------- Exportar ---------------------------- */

  const emojis = extractEmojis(emojiText);

  async function generate() {
    if (scene.elements.length === 0) return toast("Agrega algo al sticker primero.", "info");
    setExporting(true);
    setProgress(0);
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    try {
      const r = await exportSticker(hist.current, getRenderer(), { onProgress: setProgress });
      setResult({ ...r, url: URL.createObjectURL(blobOf(r.bytes, "image/webp")) });
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo exportar el sticker.", "error");
    } finally {
      setExporting(false);
    }
  }

  async function addToPack() {
    if (!result) return;
    try {
      const copy = result.bytes.slice().buffer as ArrayBuffer;
      await addToDraft({ id: newId(), bytes: copy, animated: result.animated, emojis, createdAt: Date.now() });
      toast("Agregado a tu paquete en borrador.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar en el borrador.", "error");
    }
  }

  /* ---------------------------- Interfaz ---------------------------- */

  const canExport = result && result.issues.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      {/* Escenario */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto w-[min(100%,46dvh)] lg:w-full lg:max-w-[512px]">
          <div className="checker overflow-hidden rounded-2xl border border-line">
            <canvas
              ref={canvasRef}
              width={CANVAS}
              height={CANVAS}
              className="block aspect-square w-full touch-none"
              style={{ cursor: tool === "draw" ? "crosshair" : "default" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-label="Lienzo del sticker. Toca un elemento para seleccionarlo y arrástralo para moverlo."
              role="img"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn-ghost !min-h-[40px]" onClick={undo} disabled={!hist.canUndo} aria-label="Deshacer">
              ↶ Deshacer
            </button>
            <button type="button" className="btn-ghost !min-h-[40px]" onClick={redo} disabled={!hist.canRedo} aria-label="Rehacer">
              ↷ Rehacer
            </button>
            {hasAnimation(scene) && (
              <button type="button" className="btn-ghost !min-h-[40px]" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
                {playing ? "⏸ Pausar" : "▶ Reproducir"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Panel */}
      <div className="min-w-0 space-y-4">
        <div role="tablist" aria-label="Herramientas" className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] shrink-0 rounded-xl px-3 text-sm font-semibold ${tab === t.id ? "bg-brand text-white" : "text-ink hover:bg-surface2"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="card space-y-6" role="tabpanel">
          {tab === "elements" && (
            <>
              <Section title="Agregar">
                <div className="grid grid-cols-2 gap-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                  <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
                    🖼️ Subir imagen
                  </button>
                  <button type="button" className="btn-ghost" aria-pressed={tool === "draw"} data-active={tool === "draw"} onClick={() => setTool((t) => (t === "draw" ? "select" : "draw"))}>
                    ✏️ {tool === "draw" ? "Dibujando…" : "Dibujar"}
                  </button>
                </div>
                {tool === "draw" && (
                  <div className="space-y-3 rounded-xl border border-line p-3">
                    <p className="text-sm text-muted">Dibuja con el dedo o el mouse sobre el lienzo.</p>
                    <div className="flex items-center gap-3">
                      <label htmlFor="draw-color" className="text-sm font-medium">
                        Color
                      </label>
                      <input id="draw-color" type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="h-10 w-14 rounded-lg border border-line bg-bg" />
                    </div>
                    <Slider label="Grosor del pincel" value={drawWidth} min={2} max={60} onChange={setDrawWidth} onEnd={() => undefined} />
                  </div>
                )}
                <div className="flex gap-2">
                  <input className="input" value={newText} maxLength={60} onChange={(e) => setNewText(e.target.value)} aria-label="Texto nuevo" />
                  <button type="button" className="btn-ghost shrink-0" onClick={() => addElement(makeTextEl(newText.trim() || "Texto"))}>
                    🔤 Añadir
                  </button>
                </div>
              </Section>

              <Section title="Emojis">
                <div className="grid grid-cols-6 gap-1 sm:grid-cols-9 lg:grid-cols-6">
                  {EMOJI_PALETTE.map((em) => (
                    <button key={em} type="button" className="min-h-[44px] rounded-lg text-2xl hover:bg-surface2" onClick={() => addElement(makeEmojiEl(em))} aria-label={`Añadir ${em}`}>
                      {em}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input" value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)} placeholder="Otro emoji (usa el teclado de emojis)" aria-label="Otro emoji" />
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    onClick={() => {
                      const [first] = extractEmojis(customEmoji, 1);
                      if (!first) return toast("Escribe un emoji.", "info");
                      addElement(makeEmojiEl(first));
                      setCustomEmoji("");
                    }}
                  >
                    Añadir
                  </button>
                </div>
              </Section>

              <Section title={`Capas (${scene.elements.length})`}>
                {scene.elements.length === 0 ? (
                  <p className="text-sm text-muted">Todavía no hay nada. Sube una imagen, escribe un texto o elige un emoji.</p>
                ) : (
                  <ul className="space-y-1">
                    {[...scene.elements].reverse().map((el) => (
                      <li key={el.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(el.id)}
                          aria-pressed={el.id === selectedId}
                          className={`flex min-h-[44px] w-full items-center rounded-xl border px-3 text-left text-sm ${el.id === selectedId ? "border-brand bg-brand/15" : "border-line hover:bg-surface2"}`}
                        >
                          {elLabel(el)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {selected && (
                <Section title="Elemento seleccionado">
                  <div className="grid grid-cols-4 gap-2">
                    <button type="button" className="btn-ghost !px-0" onClick={duplicateSelected} aria-label="Duplicar elemento" title="Duplicar">
                      ⧉
                    </button>
                    <button type="button" className="btn-ghost !px-0" onClick={() => moveLayer(1)} aria-label="Subir capa" title="Subir">
                      ⬆
                    </button>
                    <button type="button" className="btn-ghost !px-0" onClick={() => moveLayer(-1)} aria-label="Bajar capa" title="Bajar">
                      ⬇
                    </button>
                    <button type="button" className="btn-danger !px-0" onClick={removeSelected} aria-label="Eliminar elemento" title="Eliminar">
                      🗑
                    </button>
                  </div>

                  <Slider label="Tamaño" value={Math.round(selected.scale * 100)} min={10} max={400} display={`${Math.round(selected.scale * 100)} %`} onChange={(v) => patchLive(selected.id, { scale: v / 100 })} onEnd={endGesture} />
                  <Slider label="Rotación" value={Math.round((selected.rotation * 180) / Math.PI)} min={-180} max={180} display={`${Math.round((selected.rotation * 180) / Math.PI)}°`} onChange={(v) => patchLive(selected.id, { rotation: (v * Math.PI) / 180 })} onEnd={endGesture} />
                  <Slider label="Opacidad" value={Math.round(selected.opacity * 100)} min={10} max={100} display={`${Math.round(selected.opacity * 100)} %`} onChange={(v) => patchLive(selected.id, { opacity: v / 100 })} onEnd={endGesture} />

                  <div>
                    <label htmlFor="el-anim" className="label">
                      Animación de este elemento
                    </label>
                    <select id="el-anim" className="input" value={selected.anim} onChange={(e) => patch(selected.id, { anim: e.target.value as AnimId })}>
                      {ANIMS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selected.type === "image" && (
                    <div className="space-y-3 rounded-xl border border-line p-3">
                      <Toggle label="Quitar fondo" checked={selected.removeBg} onChange={(v) => patch(selected.id, { removeBg: v })} />
                      {selected.removeBg && (
                        <>
                          <Slider label="Sensibilidad del fondo" value={selected.tolerance} min={5} max={140} onChange={(v) => patchLive(selected.id, { tolerance: v })} onEnd={endGesture} />
                          <p className="hint">Borra el color de los bordes. Sube la sensibilidad si quedan restos; bájala si se borra parte del sujeto.</p>
                        </>
                      )}
                      <div>
                        <label htmlFor="el-filter" className="label">
                          Filtro
                        </label>
                        <select id="el-filter" className="input" value={selected.filter} onChange={(e) => patch(selected.id, { filter: e.target.value as FilterId })}>
                          {FILTERS.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-sm font-medium">Recortar</p>
                      {(
                        [
                          ["l", "Izquierda"],
                          ["r", "Derecha"],
                          ["t", "Arriba"],
                          ["b", "Abajo"],
                        ] as const
                      ).map(([k, label]) => (
                        <Slider
                          key={k}
                          label={label}
                          value={Math.round(selected.crop[k] * 100)}
                          min={0}
                          max={80}
                          display={`${Math.round(selected.crop[k] * 100)} %`}
                          onChange={(v) => {
                            const crop = { ...selected.crop, [k]: v / 100 };
                            if (crop.l + crop.r > 0.9 || crop.t + crop.b > 0.9) return;
                            patchLive(selected.id, { crop });
                          }}
                          onEnd={endGesture}
                        />
                      ))}
                    </div>
                  )}

                  {selected.type === "text" && (
                    <div className="space-y-3 rounded-xl border border-line p-3">
                      <div>
                        <label htmlFor="el-text" className="label">
                          Texto
                        </label>
                        <textarea id="el-text" className="input min-h-[72px] py-2" maxLength={80} value={selected.text} onChange={(e) => patchLive(selected.id, { text: e.target.value })} onBlur={endGesture} />
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          Relleno
                          <input type="color" value={selected.color} onChange={(e) => patchLive(selected.id, { color: e.target.value })} onBlur={endGesture} className="h-10 w-12 rounded-lg border border-line bg-bg" />
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          Contorno
                          <input type="color" value={selected.stroke || "#000000"} onChange={(e) => patchLive(selected.id, { stroke: e.target.value })} onBlur={endGesture} className="h-10 w-12 rounded-lg border border-line bg-bg" />
                        </label>
                      </div>
                      <Toggle label="Negrita" checked={selected.bold} onChange={(v) => patch(selected.id, { bold: v })} />
                      <Slider label="Tamaño de letra" value={selected.size} min={24} max={200} onChange={(v) => patchLive(selected.id, { size: v })} onEnd={endGesture} />
                    </div>
                  )}

                  {selected.type === "emoji" && (
                    <div className="rounded-xl border border-line p-3">
                      <Slider label="Tamaño del emoji" value={selected.size} min={60} max={400} onChange={(v) => patchLive(selected.id, { size: v })} onEnd={endGesture} />
                    </div>
                  )}

                  {selected.type === "draw" && (
                    <div className="space-y-3 rounded-xl border border-line p-3">
                      <label className="flex items-center gap-2 text-sm">
                        Color del trazo
                        <input type="color" value={selected.color} onChange={(e) => patchLive(selected.id, { color: e.target.value })} onBlur={endGesture} className="h-10 w-12 rounded-lg border border-line bg-bg" />
                      </label>
                      <Slider label="Grosor" value={selected.width} min={2} max={60} onChange={(v) => patchLive(selected.id, { width: v })} onEnd={endGesture} />
                    </div>
                  )}
                </Section>
              )}
            </>
          )}

          {tab === "style" && (
            <>
              <Section title="Estilo">
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_PRESETS.map((p) => (
                    <button key={p.id} type="button" className="chip justify-center" data-active={JSON.stringify(p.style) === JSON.stringify(scene.style)} onClick={() => setStyle(p.style)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Ajustes finos">
                <Toggle label="Borde blanco" checked={scene.style.outline} onChange={(v) => setStyle({ outline: v })} />
                {scene.style.outline && <Slider label="Grosor del borde" value={scene.style.outlineWidth} min={1} max={20} onChange={(v) => setStyle({ outlineWidth: v }, true)} onEnd={endGesture} />}
                <Toggle label="Sombra" checked={scene.style.shadow} onChange={(v) => setStyle({ shadow: v })} />
                <Toggle label="Luz y relieve" checked={scene.style.light} onChange={(v) => setStyle({ light: v })} />
                <Slider label="Profundidad 3D" value={scene.style.depth} min={0} max={24} display={scene.style.depth === 0 ? "sin volumen" : `${scene.style.depth}`} onChange={(v) => setStyle({ depth: v }, true)} onEnd={endGesture} />
                <p className="hint">El borde, la sombra y el volumen se aplican a todo el sticker. Deja un margen de unos 20 px en los bordes para que no se corten.</p>
              </Section>
            </>
          )}

          {tab === "anim" && (
            <>
              <Section title="Movimiento">
                <p className="text-sm text-muted">Elige una animación para cada elemento (pestaña Elementos) o aplica la misma a todos:</p>
                <div className="grid grid-cols-2 gap-2">
                  {ANIMS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="chip justify-center"
                      onClick={() => {
                        if (scene.elements.length === 0) return toast("Agrega elementos primero.", "info");
                        commit({ ...hist.current, elements: hist.current.elements.map((e) => ({ ...e, anim: a.id }) as unknown as El) });
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Duración del bucle">
                <Slider label="Duración" value={scene.durationMs} min={600} max={4000} step={100} display={`${(scene.durationMs / 1000).toFixed(1)} s`} onChange={(v) => live({ ...hist.current, durationMs: v })} onEnd={endGesture} />
                <p className="hint">Más duración = más peso. WhatsApp permite hasta 10 s y 500 KB por sticker animado; al exportar se ajusta la calidad automáticamente.</p>
              </Section>
            </>
          )}

          {tab === "export" && (
            <>
              <Section title="1. Emojis del sticker">
                <input className="input" value={emojiText} onChange={(e) => setEmojiText(e.target.value)} placeholder="😀" aria-label="Emojis del sticker" />
                <p className="hint">
                  WhatsApp pide de 1 a 3 emojis por sticker. Detectados: {emojis.length > 0 ? emojis.join(" ") : "ninguno"}
                </p>
              </Section>
              <Section title="2. Generar y validar">
                <button type="button" className="btn-primary w-full" onClick={generate} disabled={exporting || scene.elements.length === 0}>
                  {exporting ? `Generando… ${Math.round(progress * 100)} %` : hasAnimation(scene) ? "Generar sticker animado" : "Generar sticker"}
                </button>
                {result && (
                  <div className="space-y-3">
                    <div className="checker mx-auto aspect-square w-48 overflow-hidden rounded-xl border border-line">
                      <Img src={result.url} alt="Vista previa del sticker exportado" className="h-full w-full object-contain" />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <dt className="text-muted">Formato</dt>
                      <dd>WebP {result.animated ? "animado" : "estático"}</dd>
                      <dt className="text-muted">Medidas</dt>
                      <dd>512 × 512 px</dd>
                      <dt className="text-muted">Peso</dt>
                      <dd>{formatKB(result.bytes.length)}</dd>
                      {result.animated && (
                        <>
                          <dt className="text-muted">Cuadros</dt>
                          <dd>
                            {result.frameDurationsMs.length} ({result.fps} por segundo)
                          </dd>
                        </>
                      )}
                    </dl>
                    {result.issues.length === 0 ? (
                      <p className="rounded-xl border border-ok/50 bg-ok/10 p-3 text-sm text-ok" role="status">
                        ✔ Cumple los requisitos de WhatsApp.
                      </p>
                    ) : (
                      <ul className="space-y-1 rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger" role="alert">
                        {result.issues.map((i) => (
                          <li key={i.code}>✖ {i.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Section>
              <Section title="3. Guardar">
                <div className="grid gap-2">
                  <button type="button" className="btn-ghost" disabled={!canExport} onClick={() => result && downloadBlob(blobOf(result.bytes, "image/webp"), `${name.trim() || "sticker"}.webp`)}>
                    ⬇ Descargar .webp
                  </button>
                  <button type="button" className="btn-primary" disabled={!canExport || emojis.length === 0} onClick={addToPack}>
                    ➕ Agregar a mi paquete
                  </button>
                  <Link href="/pack/new" className="btn-ghost">
                    Ver mi paquete en borrador
                  </Link>
                </div>
                {result && emojis.length === 0 && <p className="hint !text-danger">Escribe al menos un emoji para poder agregarlo al paquete.</p>}
              </Section>
            </>
          )}

          {tab === "project" && (
            <>
              <Section title="Proyecto">
                <div>
                  <label htmlFor="proj-name" className="label">
                    Nombre
                  </label>
                  <input id="proj-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                    {saving ? "Guardando…" : "💾 Guardar"}
                  </button>
                  <button type="button" className="btn-ghost" onClick={newProject}>
                    Nuevo
                  </button>
                </div>
                <p className="hint">Los proyectos se guardan en tu cuenta y los ves en tu panel.</p>
              </Section>
              <Section title="Autoría y licencia">
                <fieldset className="space-y-2">
                  <legend className="label">¿De dónde sale el contenido?</legend>
                  {(
                    [
                      ["original", "Es original, lo creé yo"],
                      ["third-party", "Incluye recursos de terceros"],
                    ] as const
                  ).map(([v, label]) => (
                    <label key={v} className="flex min-h-[44px] items-center gap-3 text-sm">
                      <input type="radio" name="originality" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={originality === v} onChange={() => setOriginality(v)} />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {originality === "third-party" && (
                  <div>
                    <label htmlFor="third" className="label">
                      ¿Qué recursos y de quién? (permiso o licencia)
                    </label>
                    <textarea id="third" className="input min-h-[80px] py-2" maxLength={500} value={thirdPartyNote} onChange={(e) => setThirdPartyNote(e.target.value)} />
                  </div>
                )}
                <div>
                  <label htmlFor="license" className="label">
                    Licencia
                  </label>
                  <select id="license" className="input" value={license} onChange={(e) => setLicense(e.target.value as LicenseId)}>
                    {Object.entries(LICENSES).map(([id, l]) => (
                      <option key={id} value={id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <p className="hint">{LICENSES[license].description}</p>
                </div>
                <p className="hint">Estos datos se guardan con el proyecto y se usan como base en la ficha de autoría de tus paquetes. No se dibujan dentro del sticker.</p>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
