"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/Providers";
import { ENDPOINTS, GROUPS, buildUrl, curlFor, jsFor, pythonFor, type Endpoint } from "@/lib/endpoints";

type Result =
  | { kind: "json"; status: number; text: string; remaining: string | null }
  | { kind: "image"; status: number; url: string; filename: string; remaining: string | null }
  | { kind: "file"; status: number; url: string; filename: string; remaining: string | null }
  | { kind: "error"; message: string };

type CodeTab = "JavaScript" | "Python" | "cURL";

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
  const lastBlob = useRef<string | null>(null);
  const base = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    setValues(Object.fromEntries(selected.params.map((p) => [p.name, p.example])));
    setFile(null);
    setResult(null);
  }, [selected]);

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
    try {
      const res = await fetch(buildUrl(selected, values), {
        method: selected.method,
        headers: {
          "x-api-key": apiKey.trim(),
          ...(file ? { "content-type": file.type || "application/octet-stream", "x-file-name": file.name } : {}),
        },
        body: file ?? undefined,
      });
      const remaining = res.headers.get("x-ratelimit-remaining");
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.startsWith("image/") || res.headers.has("content-disposition")) {
        if (!res.ok) {
          const message = await res.text();
          return setResult({ kind: "error", message: message || "La API no pudo procesar la solicitud." });
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        lastBlob.current = url;
        const filename = filenameFrom(res.headers.get("content-disposition")) || res.headers.get("x-file-name") || "resultado";
        setResult({
          kind: contentType.startsWith("image/") ? "image" : "file",
          status: res.status, url, filename, remaining,
        });
      } else {
        const raw = await res.text();
        let formatted = raw;
        try {
          formatted = JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          // La respuesta no es JSON.
        }
        setResult({ kind: "json", status: res.status, text: formatted, remaining });
      }
    } catch {
      setResult({ kind: "error", message: "No se pudo conectar con la API." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Explorador de endpoints</h1>
        <p className="mt-1 text-muted">
          Ejecuta solicitudes reales, inspecciona respuestas, previsualiza imágenes y descarga archivos.{" "}
          {user ? <Link href="/dashboard" className="text-brand underline">Ir a mi panel</Link> : <Link href="/register" className="text-brand underline">Crea una cuenta gratis para obtener una clave</Link>}.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="Lista de endpoints" className="space-y-4">
          {GROUPS.map((group) => (
            <div key={group}>
              <h2 className="mb-1 px-1 text-xs font-bold uppercase tracking-wider text-muted">{group}</h2>
              <ul className="space-y-1">
                {ENDPOINTS.filter((endpoint) => endpoint.group === group).map((endpoint) => (
                  <li key={endpoint.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(endpoint)}
                      aria-current={selected.id === endpoint.id ? "true" : undefined}
                      className={"flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition " + (selected.id === endpoint.id ? "border-brand bg-brand/15" : "border-transparent hover:bg-surface2")}
                    >
                      <span className="rounded bg-accent/20 px-1.5 text-[10px] font-bold text-accent">{endpoint.method}</span>
                      <span className="truncate">{endpoint.path.replace("/api/v1", "")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <section className="card space-y-4" aria-label="Probar endpoint">
          <div>
            <p className="break-all">
              <span className="chip mr-2 !min-h-[28px] text-xs font-bold">{selected.method}</span>
              <code>{selected.path}</code>
            </p>
            <p className="mt-2 text-sm text-muted">{selected.what}</p>
          </div>

          <form onSubmit={run} className="space-y-3">
            <div>
              <label htmlFor="apikey" className="label">Tu clave de API</label>
              <input id="apikey" type="password" autoComplete="off" className="input" placeholder="amk_…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
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
                  <textarea id={"p-" + param.name} className="input min-h-20" value={values[param.name] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [param.name]: e.target.value }))} />
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

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="label !mb-0">Código de integración</h3>
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
            <h3 className="label">Resultado de la ejecución</h3>
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
                    <a href={result.url} download={result.filename} className="btn-primary mt-3 inline-flex">Descargar archivo</a>
                  </div>
                )}
                {result.kind === "json" && <pre className="max-h-96 overflow-auto rounded-xl bg-surface2 p-3 text-xs">{result.text}</pre>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
