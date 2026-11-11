"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ENDPOINTS, GROUPS, buildUrl, curlFor, jsFor, pythonFor, type Endpoint } from "@/lib/endpoints";

type HistoryRow = {
  id: string;
  endpointId: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  response: string;
  at: number;
};
type SavedRequest = { id: string; name: string; endpointId: string; values: Record<string, string> };

const HISTORY_KEY = "yuiapi-dev-history-v1";
const COLLECTION_KEY = "yuiapi-dev-collection-v1";
const FAVORITES_KEY = "yuiapi-dev-favorites-v1";

export default function DeveloperPage() {
  const [endpointId, setEndpointId] = useState(ENDPOINTS[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState("https://yuiapi.vercel.app");
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [collection, setCollection] = useState<SavedRequest[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [requestName, setRequestName] = useState("");
  const [filter, setFilter] = useState("");
  const [group, setGroup] = useState<string>("Todos");
  const [language, setLanguage] = useState<"javascript" | "python" | "curl">("javascript");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<HistoryRow | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [monthlyRequests, setMonthlyRequests] = useState<number | null>(null);

  const selected = ENDPOINTS.find((item) => item.id === endpointId) ?? ENDPOINTS[0];

  useEffect(() => {
    try {
      const savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as HistoryRow[];
      const savedCollection = JSON.parse(localStorage.getItem(COLLECTION_KEY) || "[]") as SavedRequest[];
      const savedFavorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[];
      setHistory(Array.isArray(savedHistory) ? savedHistory.slice(0, 20) : []);
      setCollection(Array.isArray(savedCollection) ? savedCollection : []);
      setFavorites(Array.isArray(savedFavorites) ? savedFavorites : []);
    } catch {
      setHistory([]);
      setCollection([]);
      setFavorites([]);
    }
    fetch("/api/me/stats", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data && typeof data.requestsThisMonth === "number") setMonthlyRequests(data.requestsThisMonth);
      })
      .catch(() => undefined);
  }, []);

  const visibleEndpoints = useMemo(() => ENDPOINTS.filter((item) => {
    const matchesGroup = group === "Todos" || item.group === group;
    const term = filter.trim().toLowerCase();
    const matchesText = !term || [item.id, item.path, item.what, item.group].some((value) => value.toLowerCase().includes(term));
    return matchesGroup && matchesText;
  }), [filter, group]);

  function chooseEndpoint(next: Endpoint) {
    setEndpointId(next.id);
    setValues(Object.fromEntries(next.params.map((param) => [param.name, param.example])));
    setFile(null);
    setResult(null);
    setError("");
    setDownloadUrl("");
  }

  function persistHistory(rows: HistoryRow[]) {
    setHistory(rows);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, 20))); } catch { setError("No se pudo guardar el historial local."); }
  }

  function persistCollection(rows: SavedRequest[]) {
    setCollection(rows);
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(rows)); } catch { setError("No se pudo guardar la colección local."); }
  }

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { setError("No se pudieron guardar los favoritos."); }
  }

  async function executeRequest() {
    if (!selected) return;
    if (!apiKey.trim()) { setError("Introduce tu API Key. Se mantiene solo en memoria durante esta sesión."); return; }
    if (selected.body === "file" && !file) { setError("Selecciona un archivo para este endpoint."); return; }
    setBusy(true);
    setError("");
    setDownloadUrl("");
    const started = performance.now();
    try {
      const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(normalizedBase)) throw new Error("Introduce una URL base válida que comience con https:// o http://.");
      const url = new URL(buildUrl(selected, values), normalizedBase + "/");
      const headers: Record<string, string> = { "x-api-key": apiKey.trim() };
      if (file) {
        headers["content-type"] = file.type || "application/octet-stream";
        headers["x-file-name"] = file.name;
      }
      const response = await fetch(url.toString(), {
        method: selected.method,
        headers,
        body: selected.body === "file" ? file : undefined,
        cache: "no-store",
      });
      const duration = Math.round(performance.now() - started);
      let responseText = "";
      let nextDownload = "";
      if (selected.returns === "json" || (response.headers.get("content-type") || "").includes("json")) {
        const raw = await response.text();
        try { responseText = JSON.stringify(JSON.parse(raw), null, 2); } catch { responseText = raw; }
      } else {
        const blob = await response.blob();
        nextDownload = URL.createObjectURL(blob);
        responseText = "Archivo recibido: " + (response.headers.get("content-type") || "tipo desconocido") + " · " + blob.size + " bytes";
      }
      const row: HistoryRow = {
        id: crypto.randomUUID(),
        endpointId: selected.id,
        method: selected.method,
        url: url.toString(),
        status: response.status,
        duration,
        response: responseText.slice(0, 12000),
        at: Date.now(),
      };
      setResult(row);
      setDownloadUrl(nextDownload);
      persistHistory([row, ...history].slice(0, 20));
      if (!response.ok) setError("La API respondió con HTTP " + response.status + ". Revisa el cuerpo de respuesta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  function saveRequest() {
    if (!selected) return;
    const name = requestName.trim() || selected.id;
    const row: SavedRequest = { id: crypto.randomUUID(), name, endpointId: selected.id, values: { ...values } };
    persistCollection([row, ...collection].slice(0, 50));
    setRequestName("");
  }

  function loadRequest(row: SavedRequest) {
    const next = ENDPOINTS.find((item) => item.id === row.endpointId);
    if (!next) return;
    setEndpointId(next.id);
    setValues({ ...row.values });
    setFile(null);
    setResult(null);
    setError("");
  }

  function generatedCode() {
    const base = baseUrl.trim().replace(/\/+$/, "");
    if (!selected) return "";
    if (language === "curl") return curlFor(selected, values, base);
    if (language === "python") return pythonFor(selected, values, base);
    return jsFor(selected, values, base);
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(generatedCode()); }
    catch { setError("No se pudo copiar. Selecciona el código y cópialo manualmente."); }
  }

  const previous = history.slice(0, 2);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="yui-hero">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-brand">YuiAPI · Developer Studio</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Tu espacio de desarrollo API</h1>
          <p className="mt-3 text-sm text-muted sm:text-base">Prueba endpoints reales, guarda solicitudes en este dispositivo y genera ejemplos de integración.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="btn-primary" href="/endpoints">Explorador clásico</Link>
            <a className="btn-ghost" href="/api/openapi" target="_blank" rel="noreferrer">OpenAPI JSON ↗</a>
            <Link className="btn-ghost" href="/docs">Documentación</Link>
          </div>
        </div>
        <div className="relative z-10 hidden min-w-40 text-right sm:block">
          <p className="text-xs text-muted">Solicitudes este mes</p>
          <p className="mt-1 text-4xl font-black">{monthlyRequests === null ? "—" : monthlyRequests.toLocaleString("es-PE")}</p>
          <p className="text-xs text-muted">Disponible con sesión iniciada</p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-xl font-bold">Request Builder</h2><p className="text-sm text-muted">Envía solicitudes a los endpoints del catálogo oficial.</p></div>
            <span className="chip">{ENDPOINTS.length} endpoints</span>
          </div>
          <label className="block"><span className="label">URL base</span><input className="input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://yuiapi.vercel.app"/></label>
          <label className="block"><span className="label">API Key</span><input className="input" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="amk_…" /><span className="hint">No se guarda en el historial ni en localStorage.</span></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">Categoría</span><select className="input" value={group} onChange={(event) => setGroup(event.target.value)}><option>Todos</option>{GROUPS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="block"><span className="label">Buscar endpoint</span><input className="input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Ej. anime, QR, sticker…"/></label>
          </div>
          <label className="block"><span className="label">Endpoint</span><select className="input" value={endpointId} onChange={(event) => { const next = ENDPOINTS.find((item) => item.id === event.target.value); if (next) chooseEndpoint(next); }}>{visibleEndpoints.map((item) => <option key={item.id} value={item.id}>{item.method} · {item.path}</option>)}</select></label>
          {selected && <div className="rounded-xl border border-line bg-bg/60 p-3"><div className="flex flex-wrap items-center gap-2"><span className="chip">{selected.method}</span><code className="break-all text-sm">{selected.path}</code><button className="ml-auto text-sm text-brand" type="button" onClick={() => toggleFavorite(selected.id)}>{favorites.includes(selected.id) ? "★ Favorito" : "☆ Favorito"}</button></div><p className="mt-2 text-sm text-muted">{selected.what}</p></div>}
          {selected?.params.map((param) => <label key={param.name} className="block"><span className="label">{param.label}</span>{param.options ? <select className="input" value={values[param.name] ?? param.example} onChange={(event) => setValues((old) => ({ ...old, [param.name]: event.target.value }))}>{param.options.map((option) => <option key={option}>{option}</option>)}</select> : <input className="input" value={values[param.name] ?? param.example} onChange={(event) => setValues((old) => ({ ...old, [param.name]: event.target.value }))} placeholder={param.example}/>}</label>)}
          {selected?.body === "file" && <label className="block"><span className="label">Archivo para enviar</span><input className="input" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)}/></label>}
          <div className="flex flex-wrap gap-2"><button className="btn-primary" type="button" disabled={busy} onClick={() => void executeRequest()}>{busy ? "Enviando…" : "▶ Ejecutar solicitud"}</button><button className="btn-ghost" type="button" onClick={saveRequest}>Guardar en colección</button></div>
          {error && <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">{error}</p>}
        </section>

        <div className="space-y-5">
          <section className="card space-y-3">
            <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-bold">Respuesta</h2>{result && <span className={"chip " + (result.status < 400 ? "text-emerald-400" : "text-red-400")}>HTTP {result.status}</span>}</div>
            {result ? <><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-bg/70 p-3"><span className="text-muted">Duración</span><p className="text-lg font-bold">{result.duration} ms</p></div><div className="rounded-xl bg-bg/70 p-3"><span className="text-muted">Método</span><p className="text-lg font-bold">{result.method}</p></div></div><p className="break-all text-xs text-muted">{result.url}</p><pre className="max-h-80 overflow-auto rounded-xl bg-bg p-3 text-xs">{result.response || "Sin contenido de texto."}</pre>{downloadUrl && <a className="btn-primary" href={downloadUrl} download="yuiapi-result">Descargar resultado</a>}</> : <p className="text-sm text-muted">Ejecuta una solicitud para ver aquí el código HTTP, tiempo y contenido de respuesta.</p>}
          </section>

          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">SDK / Código</h2><button className="btn-ghost !min-h-9" type="button" onClick={() => void copyCode()}>Copiar</button></div>
            <div className="flex flex-wrap gap-2">{(["javascript", "python", "curl"] as const).map((item) => <button key={item} className="chip" aria-pressed={language === item} onClick={() => setLanguage(item)} type="button">{item === "javascript" ? "JavaScript" : item === "python" ? "Python" : "cURL"}</button>)}</div>
            <pre className="max-h-64 overflow-auto rounded-xl bg-bg p-3 text-xs">{generatedCode()}</pre>
            <p className="text-xs text-muted">Plantillas generadas desde el catálogo de endpoints. Revisa los parámetros y requisitos de cada operación antes de integrarlas.</p>
          </section>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Colección local</h2><span className="chip">{collection.length} guardadas</span></div>
          <p className="text-sm text-muted">Las solicitudes se guardan en este navegador. La API Key nunca se incluye.</p>
          <div className="flex gap-2"><input className="input" value={requestName} onChange={(event) => setRequestName(event.target.value)} placeholder="Nombre de la solicitud"/><button className="btn-ghost" type="button" onClick={saveRequest}>Guardar</button></div>
          {collection.length ? <ul className="max-h-64 space-y-2 overflow-auto">{collection.map((row) => <li key={row.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3"><div className="min-w-0"><p className="truncate font-semibold">{row.name}</p><p className="text-xs text-muted">{row.endpointId}</p></div><div className="flex gap-1"><button className="chip" type="button" onClick={() => loadRequest(row)}>Cargar</button><button className="chip" type="button" onClick={() => persistCollection(collection.filter((item) => item.id !== row.id))}>×</button></div></li>)}</ul> : <p className="text-sm text-muted">Todavía no guardaste solicitudes.</p>}
        </section>

        <section className="card space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Historial y comparación</h2><button className="chip" type="button" onClick={() => persistHistory([])}>Limpiar</button></div>
          <p className="text-sm text-muted">Últimas 20 ejecuciones, almacenadas localmente en este dispositivo.</p>
          {history.length ? <ul className="max-h-40 space-y-2 overflow-auto">{history.map((row) => <li key={row.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-2 text-sm"><span className="min-w-0 truncate">{row.method} · {row.endpointId}</span><span className="shrink-0 text-muted">HTTP {row.status} · {row.duration} ms</span></li>)}</ul> : <p className="text-sm text-muted">No hay solicitudes en el historial.</p>}
          {previous.length === 2 && <div className="grid gap-2 sm:grid-cols-2"><div><p className="mb-1 text-xs text-muted">Ejecución más reciente</p><pre className="max-h-36 overflow-auto rounded-lg bg-bg p-2 text-xs">{previous[0].response}</pre></div><div><p className="mb-1 text-xs text-muted">Ejecución anterior</p><pre className="max-h-36 overflow-auto rounded-lg bg-bg p-2 text-xs">{previous[1].response}</pre></div></div>}
        </section>
      </div>

      <section className="card">
        <h2 className="text-xl font-bold">Herramientas adicionales</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a className="rounded-xl border border-line p-3 hover:border-brand" href="/api/openapi" target="_blank" rel="noreferrer"><strong>OpenAPI Generator</strong><p className="mt-1 text-xs text-muted">Especificación JSON desde el catálogo actual.</p></a>
          <Link className="rounded-xl border border-line p-3 hover:border-brand" href="/dashboard"><strong>API Keys</strong><p className="mt-1 text-xs text-muted">Administrar claves y cuotas.</p></Link>
          <Link className="rounded-xl border border-line p-3 hover:border-brand" href="/admin/security"><strong>Security Center</strong><p className="mt-1 text-xs text-muted">Panel de seguridad para administradores.</p></Link>
          <Link className="rounded-xl border border-line p-3 hover:border-brand" href="/docs"><strong>Versiones y documentación</strong><p className="mt-1 text-xs text-muted">Consultar la API v1 y sus límites.</p></Link>
        </div>
      </section>
    </div>
  );
}
