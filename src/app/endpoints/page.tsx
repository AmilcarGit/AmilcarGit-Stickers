"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/Providers";
import { ENDPOINTS, GROUPS, buildUrl, curlFor, jsFor, pythonFor, type Endpoint } from "@/lib/endpoints";

type StickerItem = { id: string | null; title: string | null; gif: string | null; webp: string | null; page: string | null };

type Result =
  | { kind: "json"; status: number; text: string; remaining: string | null; stickers?: StickerItem[] }
  | { kind: "image"; status: number; url: string; filename: string; remaining: string | null }
  | { kind: "file"; status: number; url: string; filename: string; remaining: string | null }
  | { kind: "error"; message: string };

type CodeTab = "JavaScript" | "Python" | "cURL";
type DownloadProgress = { status: number; loaded: number; total: number | null; phase: "receiving" | "ready" };
type TestHistory = { id: string; endpointId: string; path: string; method: string; status: number | null; duration: number; at: number; ok: boolean };

function filenameFrom(header: string | null): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? "resultado";
}

export default function EndpointsPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Endpoint>(ENDPOINTS[2]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [codeTab, setCodeTab] = useState<CodeTab>("JavaScript");
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [history, setHistory] = useState<TestHistory[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDocs, setShowDocs] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Búsqueda"]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [jsonNotice, setJsonNotice] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const lastBlob = useRef<string | null>(null);
  const base = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    setValues(Object.fromEntries(selected.params.map((p) => [p.name, p.example])));
    setFile(null);
    setResult(null);
  }, [selected]);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem("yuiapi:endpoint-favorites") || "[]") as string[]);
      setHistory(JSON.parse(localStorage.getItem("yuiapi:endpoint-history") || "[]") as TestHistory[]);
    } catch { setFavorites([]); setHistory([]); }
    finally { setStorageReady(true); }
  }, []);

  useEffect(() => { if (storageReady) localStorage.setItem("yuiapi:endpoint-favorites", JSON.stringify(favorites)); }, [favorites, storageReady]);
  useEffect(() => { if (storageReady) localStorage.setItem("yuiapi:endpoint-history", JSON.stringify(history.slice(0, 20))); }, [history, storageReady]);

  const filteredEndpoints = useMemo(() => ENDPOINTS.filter((endpoint) => {
    const matches = (endpoint.path + " " + endpoint.what + " " + endpoint.group + " " + endpoint.id).toLowerCase().includes(search.toLowerCase());
    return matches && (!showFavorites || favorites.includes(endpoint.id));
  }), [search, showFavorites, favorites]);

  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  function formatJsonParam(name: string) {
    try {
      setValues((current) => ({ ...current, [name]: JSON.stringify(JSON.parse(current[name] ?? ""), null, 2) }));
      setJsonNotice("JSON válido y formateado.");
    } catch { setJsonNotice("JSON no válido. Revisa comillas, comas y llaves."); }
  }

  useEffect(() => () => {
    if (lastBlob.current) URL.revokeObjectURL(lastBlob.current);
  }, []);

  const code = codeTab === "JavaScript"
    ? jsFor(selected, values, base || "https://yuiapi.vercel.app")
    : codeTab === "Python"
      ? pythonFor(selected, values, base || "https://yuiapi.vercel.app")
      : curlFor(selected, values, base || "https://yuiapi.vercel.app");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function run(e: FormEvent) {
    e.preventDefault();
    if (lastBlob.current) {
      URL.revokeObjectURL(lastBlob.current);
      lastBlob.current = null;
    }
    if (!apiKey.trim()) return setResult({ kind: "error", message: "Pega tu clave de API (créala en tu panel)." });
    if (selected.body === "file" && !file) return setResult({ kind: "error", message: "Selecciona el archivo que quieres procesar." });
    setBusy(true);
    setResult(null);
    setDuration(null);
    setDownloadProgress(null);
    const startedAt = performance.now();
    try {
      const res = await fetch(buildUrl(selected, values), {
        method: selected.method,
        headers: {
          "x-api-key": apiKey.trim(),
          ...(file ? { "content-type": file.type || "application/octet-stream", "x-file-name": file.name } : {}),
        },
        body: file ?? undefined,
      });
      const elapsed = Math.round(performance.now() - startedAt);
      const remaining = res.headers.get("x-ratelimit-remaining");
      const contentType = res.headers.get("content-type") ?? "";
      const isDownload = contentType.startsWith("image/") || res.headers.has("content-disposition");
      const declaredSize = Number(res.headers.get("content-length") || "0");
      if (isDownload) setDownloadProgress({ status: res.status, loaded: 0, total: declaredSize > 0 ? declaredSize : null, phase: "receiving" });
      if (isDownload) {
        if (!res.ok) {
          const message = await res.text();
          setDownloadProgress(null);
          setResult({ kind: "error", message: message || "La API no pudo procesar la solicitud." });
          return;
        }
        const chunks: BlobPart[] = [];
        let loaded = 0;
        if (res.body) {
          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.byteLength;
            setDownloadProgress({ status: res.status, loaded, total: declaredSize > 0 ? declaredSize : null, phase: "receiving" });
          }
        }
        const blob = new Blob(chunks, { type: contentType || "application/octet-stream" });
        const elapsed = Math.round(performance.now() - startedAt);
        setDuration(elapsed);
        const url = URL.createObjectURL(blob);
        lastBlob.current = url;
        const filename = filenameFrom(res.headers.get("content-disposition")) || res.headers.get("x-file-name") || "resultado";
        setResult({
          kind: contentType.startsWith("image/") ? "image" : "file",
          status: res.status, url, filename, remaining,
        });
        setDownloadProgress({ status: res.status, loaded: blob.size, total: declaredSize > 0 ? declaredSize : blob.size, phase: "ready" });
        setHistory((current) => [{ id: selected.id + "-" + Date.now(), endpointId: selected.id, path: selected.path, method: selected.method, status: res.status, duration: elapsed, at: Date.now(), ok: res.ok }, ...current].slice(0, 20));
      } else {
        const raw = await res.text();
        const elapsed = Math.round(performance.now() - startedAt);
        setDuration(elapsed);
        let formatted = raw;
        let stickers: StickerItem[] | undefined;
        try {
          const parsed: unknown = JSON.parse(raw);
          formatted = JSON.stringify(parsed, null, 2);
          if (selected.id === "sticker-search" && parsed && typeof parsed === "object" && "results" in parsed && Array.isArray(parsed.results)) {
            stickers = parsed.results.filter((item): item is StickerItem =>
              !!item && typeof item === "object" && ("webp" in item || "gif" in item),
            );
          }
        } catch {
          // La respuesta no es JSON.
        }
        setResult({ kind: "json", status: res.status, text: formatted, remaining, stickers });
        setHistory((current) => [{ id: selected.id + "-" + Date.now(), endpointId: selected.id, path: selected.path, method: selected.method, status: res.status, duration: elapsed, at: Date.now(), ok: res.ok }, ...current].slice(0, 20));
      }
    } catch {
      setDownloadProgress(null);
      setResult({ kind: "error", message: "No se pudo conectar con la API." });
      const elapsed = Math.round(performance.now() - startedAt);
      setDuration(elapsed);
      setHistory((current) => [{ id: selected.id + "-" + Date.now(), endpointId: selected.id, path: selected.path, method: selected.method, status: null, duration: elapsed, at: Date.now(), ok: false }, ...current].slice(0, 20));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/10 via-surface to-accent/10 p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-brand">YuiAPI · Developer platform</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">API Explorer <span className="text-brand">Pro</span></h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Explora, documenta y prueba endpoints desde un solo espacio. Favoritos e historial se guardan únicamente en este dispositivo.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="chip">{ENDPOINTS.length} endpoints documentados</span><span className="chip">REST · JSON</span><span className="chip">JavaScript · Python · cURL</span></div>
        <p className="mt-3 text-xs">{user ? <Link href="/dashboard" className="text-brand underline">Ir a mi panel</Link> : <Link href="/register" className="text-brand underline">Crear cuenta gratis</Link>}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav aria-label="Lista de endpoints" className="min-w-0 space-y-3">
          <input aria-label="Buscar endpoints" value={search} onChange={(e) => setSearch(e.target.value)} className="input" placeholder="Buscar endpoint o ruta..." />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setShowFavorites(false)} className={"btn-secondary " + (!showFavorites ? "border-brand text-brand" : "")}>Todos ({ENDPOINTS.length})</button>
            <button type="button" onClick={() => setShowFavorites(true)} className={"btn-secondary " + (showFavorites ? "border-brand text-brand" : "")}>★ Favoritos ({favorites.length})</button>
          </div>
          {GROUPS.map((group) => {
            const items = filteredEndpoints.filter((endpoint) => endpoint.group === group);
            if (!items.length) return null;
            const expanded = search.trim().length > 0 || expandedGroups.includes(group);
            const folderIcons: Record<string, string> = {
              "Stickers": "✳", "Búsqueda": "⌕", "Descargas y archivos": "⇩",
              "Imágenes": "▧", "Generadores": "✣", "Desarrolladores": "{ }", "Cuenta": "◉",
            };
            return <section key={group} className="overflow-hidden rounded-xl border border-line bg-surface/60">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group])}
                className="flex w-full items-center gap-2 px-3 py-3 text-left transition hover:bg-surface2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">{folderIcons[group]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{group}</span>
                  <span className="block text-[10px] text-muted">{items.length} {items.length === 1 ? "endpoint" : "endpoints"}</span>
                </span>
                <span className="text-xs text-muted">{expanded ? "−" : "+"}</span>
              </button>
              {expanded && <ul className="space-y-1 border-t border-line p-2">{items.map((endpoint) => <li key={endpoint.id}>
                <div className={"flex items-center gap-1 rounded-xl border px-2 py-1 " + (selected.id === endpoint.id ? "border-brand bg-brand/10" : "border-transparent hover:bg-surface2")}>
                  <button type="button" onClick={() => setSelected(endpoint)} aria-current={selected.id === endpoint.id ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-xs">
                    <span className="rounded bg-accent/20 px-1.5 py-1 text-[9px] font-bold text-accent">{endpoint.method}</span><span className="truncate">{endpoint.path.replace("/api/v1", "")}</span>
                  </button>
                  <button type="button" aria-label="Alternar favorito" onClick={() => toggleFavorite(endpoint.id)} className={"px-2 py-1 text-sm " + (favorites.includes(endpoint.id) ? "text-amber-400" : "text-muted")}>{favorites.includes(endpoint.id) ? "★" : "☆"}</button>
                </div>
              </li>)}</ul>}
              {group === "Descargas y archivos" && expanded && <p className="border-t border-line px-3 py-2 text-[10px] leading-relaxed text-muted">Incluye descargas de YouTube (audio y video) y resolución de medios públicos de Pinterest. Límite configurado: hasta 800 MB por archivo. La velocidad y disponibilidad dependen del proveedor externo y de que el Pin exponga un archivo multimedia directo.</p>}
            </section>;
          })}
          {!filteredEndpoints.length && <p className="rounded-xl border border-line p-3 text-xs text-muted">No hay endpoints que coincidan.</p>}
          <div className="rounded-xl border border-line p-3">
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold">Historial reciente <span>{showHistory ? "−" : "+"}</span></button>
            {showHistory && <div className="mt-3 space-y-2">{history.length ? history.slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => { const found = ENDPOINTS.find((endpoint) => endpoint.id === item.endpointId); if (found) setSelected(found); }} className="block w-full text-left text-xs"><span className={item.ok ? "text-ok" : "text-danger"}>●</span> {item.method} {item.path}<span className="block text-muted">{item.status ?? "Sin respuesta"} · {item.duration} ms</span></button>) : <p className="text-xs text-muted">Todavía no hay pruebas.</p>}</div>}
          </div>
        </nav>
        <section className="card space-y-4" aria-label="Probar endpoint">
          <div>
            <p className="break-all">
              <span className="chip mr-2 !min-h-[28px] text-xs font-bold">{selected.method}</span>
              <code>{selected.path}</code>
              <button type="button" onClick={() => toggleFavorite(selected.id)} className="ml-2 text-sm text-amber-400" aria-label="Alternar favorito">{favorites.includes(selected.id) ? "★ Guardado" : "☆ Favorito"}</button>
            </p>
            <p className="mt-2 text-sm text-muted">{selected.what}</p>
          </div>

          <form onSubmit={run} className="space-y-3">
            <div>
              <label htmlFor="apikey" className="label">Tu clave de API</label>
              <div className="flex gap-2"><input id="apikey" type={showApiKey ? "text" : "password"} autoComplete="off" className="input min-w-0 flex-1" placeholder="amk_…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /><button type="button" className="btn-secondary" onClick={() => setShowApiKey((v) => !v)}>{showApiKey ? "Ocultar" : "Mostrar"}</button></div>
              <p className="hint">La clave solo permanece en la memoria de esta pestaña; no se guarda.</p>
            </div>

            {selected.params.map((param) => (
              <div key={param.name}>
                <label htmlFor={"p-" + param.name} className="label">{param.label} <code className="text-xs text-muted">{param.name}</code></label>
                {param.options ? (
                  <select id={"p-" + param.name} className="input" value={values[param.name] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [param.name]: e.target.value }))}>
                    {param.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <>
                    <textarea id={"p-" + param.name} className="input min-h-20 font-mono text-sm" value={values[param.name] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [param.name]: e.target.value }))} />
                    {param.name === "text" && (values[param.name] ?? "").trim().startsWith("{") && <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => formatJsonParam(param.name)}>Formatear / validar JSON</button>{jsonNotice && <span className="text-xs text-muted">{jsonNotice}</span>}</div>}
                  </>
                )}
              </div>
            ))}

            {selected.body === "file" && (
              <div>
                <label htmlFor="file" className="label">Archivo de entrada (máx. 4 MB)</label>
                <input id="file" type="file" className="input py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {file && <p className="hint">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Procesando…" : "▶ Probar endpoint"}</button>
          </form>

          <section className="rounded-xl border border-line p-3">
            <button type="button" onClick={() => setShowDocs((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold">Documentación del endpoint <span>{showDocs ? "−" : "+"}</span></button>
            {showDocs && <div className="mt-3 space-y-3 text-sm">
              <p className="text-muted">{selected.what}</p>
              <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-surface2 p-2"><span className="block text-[10px] uppercase text-muted">Método</span><strong>{selected.method}</strong></div><div className="rounded-lg bg-surface2 p-2"><span className="block text-[10px] uppercase text-muted">Respuesta</span><strong>{selected.returns.toUpperCase()}</strong></div><div className="rounded-lg bg-surface2 p-2"><span className="block text-[10px] uppercase text-muted">Autenticación</span><strong>x-api-key</strong></div></div>
              <div><h4 className="mb-1 text-xs font-bold uppercase text-muted">Parámetros</h4>{selected.params.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-line text-muted"><th className="p-2">Nombre</th><th className="p-2">Descripción</th><th className="p-2">Ejemplo</th></tr></thead><tbody>{selected.params.map((param) => <tr key={param.name} className="border-b border-line/60"><td className="p-2 font-mono">{param.name}</td><td className="p-2">{param.label}</td><td className="p-2 font-mono">{param.example}</td></tr>)}</tbody></table></div> : <p className="text-xs text-muted">No requiere parámetros de URL.</p>}</div>
              {selected.body === "file" && <p className="rounded-lg bg-surface2 p-2 text-xs text-muted">Cuerpo de solicitud: archivo binario. Adjunta el archivo en el formulario de prueba.</p>}
            </div>}
          </section>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="label !mb-0">Ejemplos de integración</h3>
              <div className="flex flex-wrap gap-1">
                {(["JavaScript", "Python", "cURL"] as const).map((tab) => (
                  <button key={tab} type="button" onClick={() => setCodeTab(tab)} className={"rounded-lg px-3 py-1.5 text-xs " + (codeTab === tab ? "bg-brand text-white" : "bg-surface2")}>{tab}</button>
                ))}
              </div>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-surface2 p-3 text-xs">{code}</pre>
            <button type="button" onClick={copyCode} className="btn-secondary">{copied ? "✓ Código copiado" : "Copiar código"}</button>
          </div>

          <div aria-live="polite" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="label !mb-0">Respuesta del servidor</h3>{duration !== null && <span className="chip text-xs">⏱ {duration} ms</span>}</div>
            {downloadProgress && <div className="rounded-xl border border-line bg-surface2 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong>HTTP {downloadProgress.status}</strong><span className="text-muted">{downloadProgress.phase === "ready" ? "Archivo recibido" : "Recibiendo archivo…"} · {(downloadProgress.loaded / 1048576).toFixed(2)} MB{downloadProgress.total !== null ? " / " + (downloadProgress.total / 1048576).toFixed(2) + " MB" : ""}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: downloadProgress.phase === "ready" ? "100%" : downloadProgress.total ? Math.min(99, downloadProgress.loaded / downloadProgress.total * 100) + "%" : "35%" }} /></div>
              <p className="text-[11px] text-muted">{downloadProgress.phase === "ready" ? "La descarga está lista. Pulsa el botón para guardar el archivo." : downloadProgress.total ? Math.min(99, Math.round(downloadProgress.loaded / downloadProgress.total * 100)) + "% completado" : "El servidor no informó el tamaño total; se muestra el volumen recibido. Límite configurado: 800 MB."}</p>
            </div> }
            {result?.kind === "error" && <p className="rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger" role="alert">{result.message}</p>}
            {result && result.kind !== "error" && (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  HTTP <strong className={result.status < 400 ? "text-ok" : "text-danger"}>{result.status}</strong>
                  {result.remaining !== null && " · solicitudes restantes hoy: " + result.remaining}
                </p>
                {result.kind === "image" && (
                  <div className="space-y-2">
                    <div className="checker rounded-xl border border-line p-3">
                      <img src={result.url} alt="Vista previa del resultado" className="mx-auto max-h-96 max-w-full rounded-lg object-contain" />
                    </div>
                    <a href={result.url} download={result.filename} className="btn-primary inline-flex">Descargar {result.filename}</a>
                  </div>
                )}
                {result.kind === "file" && (
                  <div className="rounded-xl border border-line bg-surface2 p-4">
                    <p className="text-sm font-semibold">Archivo preparado: {result.filename}</p>
                    <p className="mt-1 text-xs text-muted">Tamaño: {((downloadProgress?.loaded ?? 0) / 1048576).toFixed(2)} MB</p>
                    <a href={result.url} download={result.filename} className="btn-primary mt-3 inline-flex">Descargar archivo</a>
                  </div>
                )}
                {result.kind === "json" && result.stickers && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Stickers encontrados ({result.stickers.length})</h4>
                    {result.stickers.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {result.stickers.map((sticker, index) => {
                          const preview = sticker.webp || sticker.gif;
                          return (
                            <article key={sticker.id ?? index} className="overflow-hidden rounded-xl border border-line bg-surface2">
                              {preview ? (
                                <a href={sticker.page || preview} target="_blank" rel="noreferrer" className="checker flex aspect-square items-center justify-center p-3">
                                  <img src={preview} alt={sticker.title || "Sticker de GIPHY"} loading="lazy" className="max-h-full max-w-full object-contain" />
                                </a>
                              ) : <div className="flex aspect-square items-center justify-center text-xs text-muted">Vista previa no disponible</div>}
                              <div className="space-y-2 p-2">
                                <p className="line-clamp-2 text-xs">{sticker.title || "Sticker"}</p>
                                {sticker.page && <a href={sticker.page} target="_blank" rel="noreferrer" className="text-xs text-brand underline">Abrir en GIPHY</a>}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : <p className="text-sm text-muted">No se encontraron stickers para esa búsqueda.</p>}
                    <p className="text-xs text-muted">Powered by GIPHY</p>
                  </div>
                )}
                {result.kind === "json" && <details className="rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Ver respuesta JSON</summary><pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-surface2 p-3 text-xs">{result.text}</pre></details>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
