"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Img } from "@/components/Img";
import { useAuth, useToast } from "@/components/Providers";
import { ReportDialog } from "@/components/ReportDialog";
import { blobOf } from "@/lib/bytes";
import { LICENSES, buildCredits, creditsToText } from "@/lib/credits";
import { deletePack, getPack, registerDownload, setFavorite, updatePackInfo } from "@/lib/data";
import { downloadBlob } from "@/lib/export";
import { slugify } from "@/lib/pack-zip";
import type { Pack } from "@/lib/types";

export default function PackPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, refresh } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [pack, setPack] = useState<Pack | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPack(id)
      .then((found) => {
        if (cancelled) return;
        setPack(found?.pack ?? null);
        setFav(found?.favorited ?? false);
        setState(found ? "ready" : "missing");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
    };
  }, [id, user?.uid]);

  const closeReport = useCallback(() => setReporting(false), []);

  if (state === "loading") return <p className="text-muted" role="status">Cargando paquete…</p>;
  if (state === "missing" || !pack) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-xl font-bold">Paquete no disponible</h1>
        <p className="mt-2 text-muted">No existe, es privado o fue retirado.</p>
        <Link href="/explore" className="btn-primary mt-4 inline-flex">
          Explorar paquetes
        </Link>
      </div>
    );
  }

  const isOwner = user?.uid === pack.ownerId;
  const credits = buildCredits({
    creatorName: pack.ownerName,
    username: pack.ownerUsername,
    createdAt: new Date(pack.createdAt),
    originality: pack.originality,
    thirdPartyNote: pack.thirdPartyNote,
    license: pack.license,
    siteUrl: typeof window === "undefined" ? "" : window.location.origin,
  });

  async function toggleFav() {
    if (!user || !pack) return toast("Inicia sesión para guardar favoritos.", "info");
    setBusy(true);
    try {
      const favCount = await setFavorite(pack.id, !fav);
      setPack({ ...pack, favCount });
      setFav(!fav);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo actualizar el favorito.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function download(format: "zip" | "wastickers" = "zip") {
    if (!pack) return;
    setBusy(true);
    try {
      const res = await fetch("/api/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          title: pack.title,
          publisher: pack.ownerName,
          animated: pack.animated,
          credits: creditsToText(credits),
          trayUrl: pack.trayUrl,
          stickers: pack.stickers.map((s) => ({ url: s.url, emojis: s.emojis })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo descargar el paquete.");
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (format === "wastickers") {
        downloadBlob(blobOf(bytes, "application/octet-stream"), `${slugify(pack.title)}.wastickers`);
        toast("Listo. Abre el archivo con Sticker Maker y toca «Agregar a WhatsApp».", "ok");
      } else {
        downloadBlob(blobOf(bytes, "application/zip"), `${slugify(pack.title)}.zip`);
        toast("ZIP descargado. Dentro tienes las instrucciones (LEEME.txt).", "ok");
      }
      void registerDownload(pack.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo descargar el paquete.", "error");
    } finally {
      setBusy(false);
    }
  }

  /** Comparte un solo sticker (archivo WebP) con otra app, p. ej. WhatsApp. Si el teléfono no lo permite, lo descarga. */
  async function sendSticker(url: string, index: number) {
    const name = `${slugify(pack?.title ?? "sticker")}-${index + 1}.webp`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("archivo no disponible");
      const file = new File([await res.blob()], name, { type: "image/webp" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      downloadBlob(file, name);
      toast("Tu navegador no puede compartir archivos; el sticker se descargó.", "info");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // la persona canceló
      toast("No se pudo enviar el sticker. Prueba con «Descargar ZIP».", "error");
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: pack?.title, text: `Mira este paquete de stickers: ${pack?.title}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Enlace copiado.", "ok");
      }
    } catch {
      // Compartir cancelado por la persona: no es un error.
    }
  }

  async function toggleVisibility() {
    if (!pack) return;
    const visibility = pack.visibility === "public" ? "private" : "public";
    try {
      setPack(await updatePackInfo(pack.id, { visibility }));
      toast(visibility === "public" ? "Ahora es público." : "Ahora es privado.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo cambiar la visibilidad.", "error");
    }
  }

  async function remove() {
    if (!pack || !confirm("¿Eliminar este paquete? No se puede deshacer.")) return;
    try {
      await deletePack(pack.id);
      await refresh();
      toast("Paquete eliminado.", "ok");
      router.push("/dashboard");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo eliminar el paquete.", "error");
    }
  }

  return (
    <div className="space-y-8">
      {pack.status === "removed" && (
        <div className="rounded-2xl border border-danger/60 bg-danger/10 p-4 text-sm text-danger" role="alert">
          Este paquete fue retirado por moderación y no es visible para el público.
        </div>
      )}

      <header className="flex flex-wrap items-center gap-4">
        <Img src={pack.trayUrl} alt="" className="h-20 w-20 rounded-2xl border border-line bg-surface2 object-contain" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">{pack.title}</h1>
          <p className="text-muted">
            por{" "}
            <Link href={`/u/${pack.ownerUsername}`} className="text-brand hover:underline">
              {pack.ownerName || pack.ownerUsername}
            </Link>{" "}
            · {pack.stickers.length} stickers · {pack.animated ? "animado" : "estático"} · {pack.category}
          </p>
          {pack.tags.length > 0 && <p className="mt-1 text-sm text-muted">{pack.tags.map((t) => `#${t}`).join(" ")}</p>}
        </div>
      </header>

      {pack.description && <p className="max-w-2xl">{pack.description}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => download("wastickers")} disabled={busy}>
          ➕ Agregar a WhatsApp ({pack.downloadCount})
        </button>
        <button type="button" className="btn-ghost" onClick={() => download("zip")} disabled={busy}>
          ⬇ ZIP
        </button>
        <button type="button" className="btn-ghost" onClick={toggleFav} disabled={busy} aria-pressed={fav}>
          {fav ? "♥" : "♡"} Favorito ({pack.favCount})
        </button>
        <button type="button" className="btn-ghost" onClick={share}>
          Compartir
        </button>
        {!isOwner && (
          <button type="button" className="btn-ghost" onClick={() => setReporting(true)}>
            🚩 Reportar
          </button>
        )}
        {isOwner && (
          <>
            <button type="button" className="btn-ghost" onClick={toggleVisibility} disabled={pack.status === "removed"}>
              {pack.visibility === "public" ? "Hacer privado" : "Hacer público"}
            </button>
            <button type="button" className="btn-danger" onClick={remove}>
              Eliminar
            </button>
          </>
        )}
      </div>

      <section aria-labelledby="stickers">
        <h2 id="stickers" className="sr-only">
          Stickers del paquete
        </h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {pack.stickers.map((s, i) => (
            <li key={s.url} className="space-y-1">
              <div className="checker aspect-square overflow-hidden rounded-xl border border-line p-1">
                <Img src={s.url} alt={`Sticker ${i + 1}${s.emojis.length ? ` (${s.emojis.join(" ")})` : ""}`} className="h-full w-full object-contain" />
              </div>
              <button type="button" className="btn-ghost w-full !min-h-[36px] !px-2 text-xs" onClick={() => sendSticker(s.url, i)} aria-label={`Enviar el sticker ${i + 1} a WhatsApp u otra app`}>
                Enviar
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          <strong>Agregar a WhatsApp</strong> descarga un archivo que abre la app gratuita{" "}
          <em>Sticker Maker</em> (Android y iPhone); allí tocas «Agregar a WhatsApp» y el paquete queda instalado. WhatsApp no permite hacerlo directamente desde una página web.
          «Enviar» solo manda el sticker como imagen normal en la mayoría de teléfonos. El ZIP trae los WebP, el ícono y las instrucciones para otras apps.
        </p>
      </section>

      <section aria-labelledby="ficha" className="card">
        <h2 id="ficha" className="mb-2 text-xl font-bold">
          Ficha de autoría
        </h2>
        <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-muted">{creditsToText(credits)}</pre>
        <p className="mt-3 text-xs text-muted">
          Licencia: {LICENSES[pack.license].description}{" "}
          <Link href="/legal" className="underline">
            Más información
          </Link>
        </p>
      </section>

      {reporting && <ReportDialog pack={pack} onClose={closeReport} />}
    </div>
  );
}
