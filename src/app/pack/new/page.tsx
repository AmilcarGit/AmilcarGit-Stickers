"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { Img } from "@/components/Img";
import { useAuth, useToast } from "@/components/Providers";
import { blobOf, formatKB } from "@/lib/bytes";
import { LICENSES, buildCredits, creditsToText, type LicenseId, type Originality } from "@/lib/credits";
import { publishPack } from "@/lib/data";
import { clearDraft, listDraft, removeFromDraft, updateDraft, type DraftSticker } from "@/lib/draft";
import { downloadBlob, makeTrayIcon } from "@/lib/export";
import { buildPackZip, slugify } from "@/lib/pack-zip";
import { CATEGORIES, type Category } from "@/lib/types";
import { WA, extractEmojis, validatePack } from "@/lib/whatsapp";

function PackBuilder() {
  const { user } = useAuth();
  const profile = user;
  const toast = useToast();
  const router = useRouter();

  const [items, setItems] = useState<DraftSticker[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"" | "zip" | "publish">("");
  const [progress, setProgress] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("Otros");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [license, setLicense] = useState<LicenseId>("all-rights-reserved");
  const [originality, setOriginality] = useState<Originality>("original");
  const [thirdPartyNote, setThirdPartyNote] = useState("");

  const reload = useCallback(async () => {
    try {
      setItems(await listDraft());
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo leer el borrador.", "error");
    }
    setLoaded(true);
  }, [toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const urls: Record<string, string> = {};
    for (const it of items) urls[it.id] = URL.createObjectURL(blobOf(new Uint8Array(it.bytes), "image/webp"));
    setPreviews(urls);
    return () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
  }, [items]);

  const animated = items.some((i) => i.animated);
  const issues = useMemo(
    () => validatePack({ stickers: items.map((i) => ({ animated: i.animated, emojis: i.emojis, bytes: i.bytes.byteLength })) }),
    [items],
  );
  const titleOk = title.trim().length >= 1 && title.trim().length <= 60;
  const ready = issues.length === 0 && titleOk;

  async function setEmojis(id: string, text: string) {
    const emojis = extractEmojis(text);
    setItems((list) => list.map((i) => (i.id === id ? { ...i, emojis } : i)));
    try {
      await updateDraft(id, { emojis });
    } catch {
      toast("No se pudieron guardar los emojis.", "error");
    }
  }

  async function remove(id: string) {
    try {
      await removeFromDraft(id);
      await reload();
    } catch {
      toast("No se pudo quitar el sticker.", "error");
    }
  }

  async function discard() {
    if (!confirm("¿Vaciar el borrador del paquete? Se quitarán todos los stickers.")) return;
    try {
      await clearDraft();
      await reload();
    } catch {
      toast("No se pudo vaciar el borrador.", "error");
    }
  }

  function credits() {
    return buildCredits({
      creatorName: profile?.displayName ?? "",
      username: profile?.username ?? "",
      createdAt: new Date(),
      originality,
      thirdPartyNote,
      license,
      siteUrl: window.location.origin,
    });
  }

  async function downloadZip() {
    if (!ready || !profile) return;
    setBusy("zip");
    try {
      const tray = await makeTrayIcon(new Uint8Array(items[0].bytes));
      const zip = await buildPackZip({
        title: title.trim(),
        publisher: profile.displayName,
        animated,
        tray,
        credits: creditsToText(credits()),
        stickers: items.map((i) => ({ bytes: new Uint8Array(i.bytes), emojis: i.emojis })),
      });
      downloadBlob(blobOf(zip, "application/zip"), `${slugify(title)}.zip`);
      toast("ZIP descargado. Dentro tienes las instrucciones (LEEME.txt).", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear el ZIP.", "error");
    } finally {
      setBusy("");
    }
  }

  async function upload(bytes: Uint8Array, kind: "sticker" | "tray", name: string, type: string): Promise<string> {
    const form = new FormData();
    form.append("file", new File([blobOf(bytes, type)], name, { type }));
    form.append("kind", kind);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "No se pudo subir un archivo.");
    return data.url as string;
  }

  async function publish() {
    if (!ready || !user || !profile) return;
    if (!user.emailVerified) return toast("Verifica tu correo para publicar.", "error");
    if (!confirm(`¿Publicar «${title.trim()}» con ${items.length} stickers?`)) return;
    setBusy("publish");
    try {
      const uploaded: { url: string; emojis: string[]; bytes: number }[] = [];
      for (let i = 0; i < items.length; i++) {
        setProgress(`Subiendo sticker ${i + 1} de ${items.length}…`);
        const bytes = new Uint8Array(items[i].bytes);
        uploaded.push({ url: await upload(bytes, "sticker", `${i + 1}.webp`, "image/webp"), emojis: items[i].emojis, bytes: bytes.length });
      }
      setProgress("Subiendo el ícono del paquete…");
      const trayUrl = await upload(await makeTrayIcon(new Uint8Array(items[0].bytes)), "tray", "tray.png", "image/png");
      setProgress("Publicando…");
      const published = await publishPack({
        title: title.trim(),
        description: description.trim().slice(0, 500),
        category,
        tags: tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8),
        animated,
        visibility,
        license,
        originality,
        thirdPartyNote: originality === "third-party" ? thirdPartyNote.trim().slice(0, 500) : "",
        stickers: uploaded,
        trayUrl,
      });
      await clearDraft();
      toast("¡Paquete publicado!", "ok");
      router.push(`/p/${published.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo publicar el paquete.", "error");
    } finally {
      setBusy("");
      setProgress("");
    }
  }

  return (
    <div className="space-y-8">
      <VerifyBanner />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Mi paquete</h1>
          <p className="mt-1 text-muted">
            De {WA.minStickers} a {WA.maxStickers} stickers, todos estáticos o todos animados.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/editor" className="btn-primary">
            ➕ Crear otro sticker
          </Link>
          {items.length > 0 && (
            <button type="button" className="btn-danger" onClick={discard}>
              Vaciar
            </button>
          )}
        </div>
      </header>

      <section aria-labelledby="stickers" className="space-y-3">
        <h2 id="stickers" className="text-xl font-bold">
          Stickers ({items.length}/{WA.maxStickers})
        </h2>
        {!loaded ? (
          <p className="text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="card text-muted">
            El borrador está vacío. Crea un sticker en el editor, genera el WebP y pulsa «Agregar a mi paquete».
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((it, idx) => (
              <li key={it.id} className="card !p-3">
                <div className="checker aspect-square overflow-hidden rounded-xl">
                  {previews[it.id] && <Img src={previews[it.id]} alt={`Sticker ${idx + 1}`} className="h-full w-full object-contain" />}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {it.animated ? "Animado" : "Estático"} · {formatKB(it.bytes.byteLength)}
                </p>
                <label className="sr-only" htmlFor={`em-${it.id}`}>
                  Emojis del sticker {idx + 1}
                </label>
                <input id={`em-${it.id}`} className="input mt-1 !min-h-[40px]" defaultValue={it.emojis.join("")} onBlur={(e) => setEmojis(it.id, e.target.value)} />
                <button type="button" className="mt-2 text-xs text-danger hover:underline" onClick={() => remove(it.id)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        {loaded && issues.length > 0 && items.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-gold/50 bg-gold/10 p-3 text-sm" role="status">
            {issues.map((i, n) => (
              <li key={`${i.code}-${n}`}>• {i.message}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="datos" className="card space-y-4">
        <h2 id="datos" className="text-xl font-bold">
          Datos del paquete
        </h2>
        <div>
          <label htmlFor="title" className="label">
            Nombre del paquete
          </label>
          <input id="title" className="input" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="desc" className="label">
            Descripción (opcional)
          </label>
          <textarea id="desc" className="input min-h-[80px] py-2" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cat" className="label">
              Categoría
            </label>
            <select id="cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tags" className="label">
              Etiquetas (separadas por coma)
            </label>
            <input id="tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="gatos, 3d, graciosos" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="vis" className="label">
              Visibilidad
            </label>
            <select id="vis" className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")}>
              <option value="public">Público (aparece en Explorar)</option>
              <option value="private">Privado (solo tú y quien tenga el enlace)</option>
            </select>
          </div>
          <div>
            <label htmlFor="lic" className="label">
              Licencia
            </label>
            <select id="lic" className="input" value={license} onChange={(e) => setLicense(e.target.value as LicenseId)}>
              {Object.entries(LICENSES).map(([id, l]) => (
                <option key={id} value={id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="label">Autoría del contenido</legend>
          {(
            [
              ["original", "Es original, lo creé yo"],
              ["third-party", "Incluye recursos de terceros"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex min-h-[44px] items-center gap-3 text-sm">
              <input type="radio" name="orig" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={originality === v} onChange={() => setOriginality(v)} />
              {label}
            </label>
          ))}
          {originality === "third-party" && (
            <textarea className="input min-h-[72px] py-2" maxLength={500} value={thirdPartyNote} onChange={(e) => setThirdPartyNote(e.target.value)} placeholder="Qué recursos y de quién, con su permiso o licencia" aria-label="Recursos de terceros" />
          )}
        </fieldset>
      </section>

      {profile && (
        <section aria-labelledby="ficha" className="card">
          <h2 id="ficha" className="mb-2 text-xl font-bold">
            Ficha de autoría
          </h2>
          <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-muted">{creditsToText(buildCredits({ creatorName: profile.displayName, username: profile.username, createdAt: new Date(), originality, thirdPartyNote, license, siteUrl: "" }))}</pre>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" disabled={!ready || busy !== ""} onClick={downloadZip}>
          {busy === "zip" ? "Armando ZIP…" : "⬇ Descargar ZIP"}
        </button>
        <button type="button" className="btn-primary" disabled={!ready || busy !== "" || !user?.emailVerified} onClick={publish}>
          {busy === "publish" ? progress || "Publicando…" : "🚀 Publicar paquete"}
        </button>
        {!titleOk && items.length > 0 && <span className="text-sm text-muted">Escribe el nombre del paquete.</span>}
        {user && !user.emailVerified && <span className="text-sm text-muted">Verifica tu correo para publicar.</span>}
      </section>
    </div>
  );
}

export default function NewPackPage() {
  return (
    <RequireAuth>
      <PackBuilder />
    </RequireAuth>
  );
}
