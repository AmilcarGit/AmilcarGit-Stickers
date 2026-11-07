"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/Providers";
import { ENDPOINTS, GROUPS, buildUrl, curlFor, type Endpoint } from "@/lib/endpoints";

type Result =
  | { kind: "json"; status: number; text: string; remaining: string | null }
  | { kind: "image"; status: number; url: string; remaining: string | null }
  | { kind: "error"; message: string };

export default function EndpointsPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Endpoint>(ENDPOINTS[2]);
  const [values, setValues] = useState<Record<string, string>>({});
  // La clave solo vive en memoria de esta pestaña: no se guarda en ningún sitio.
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const lastBlob = useRef<string | null>(null);
  const base = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    setValues(Object.fromEntries(selected.params.map((p) => [p.name, p.example])));
    setFile(null);
    setResult(null);
  }, [selected]);

  useEffect(
    () => () => {
      if (lastBlob.current) URL.revokeObjectURL(lastBlob.current);
    },
    [],
  );

  async function run(e: FormEvent) {
    e.preventDefault();
    if (lastBlob.current) {
      URL.revokeObjectURL(lastBlob.current);
      lastBlob.current = null;
    }
    if (!apiKey.trim()) return setResult({ kind: "error", message: "Pega tu clave de API (créala en tu panel)." });
    if (selected.body === "file" && !file) return setResult({ kind: "error", message: "Elige una imagen." });
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(buildUrl(selected, values), {
        method: selected.method,
        headers: { "x-api-key": apiKey.trim(), ...(file ? { "content-type": file.type || "application/octet-stream" } : {}) },
        body: file ?? undefined,
      });
      const remaining = res.headers.get("x-ratelimit-remaining");
      if ((res.headers.get("content-type") ?? "").startsWith("image/")) {
        const url = URL.createObjectURL(await res.blob());
        lastBlob.current = url;
        setResult({ kind: "image", status: res.status, url, remaining });
      } else {
        const raw = await res.text();
        let text = raw;
        try {
          text = JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          /* no era JSON: se muestra tal cual */
        }
        setResult({ kind: "json", status: res.status, text, remaining });
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
        <h1 className="text-3xl font-bold">Endpoints</h1>
        <p className="mt-1 text-muted">
          Elige uno, completa los parámetros y pruébalo en vivo con tu clave.{" "}
          {user ? (
            <Link href="/dashboard" className="text-brand underline">
              Ir a mi panel
            </Link>
          ) : (
            <Link href="/register" className="text-brand underline">
              Crea una cuenta gratis para obtener una clave
            </Link>
          )}
          .
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="Lista de endpoints" className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g}>
              <h2 className="mb-1 px-1 text-xs font-bold uppercase tracking-wider text-muted">{g}</h2>
              <ul className="space-y-1">
                {ENDPOINTS.filter((x) => x.group === g).map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(x)}
                      aria-current={selected.id === x.id ? "true" : undefined}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                        selected.id === x.id ? "border-brand bg-brand/15" : "border-transparent hover:bg-surface2"
                      }`}
                    >
                      <span className="rounded bg-accent/20 px-1.5 text-[10px] font-bold text-accent">{x.method}</span>
                      <span className="truncate">{x.path.replace("/api/v1", "")}</span>
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
              <span className="chip !min-h-[28px] mr-2 text-xs font-bold">{selected.method}</span>
              <code>{selected.path}</code>
            </p>
            <p className="mt-2 text-sm text-muted">{selected.what}</p>
          </div>

          <form onSubmit={run} className="space-y-3">
            <div>
              <label htmlFor="apikey" className="label">
                Tu clave de API
              </label>
              <input
                id="apikey"
                type="password"
                autoComplete="off"
                className="input"
                placeholder="amk_…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="hint">Solo se usa desde esta pestaña y se pierde al recargar.</p>
            </div>

            {selected.params.map((p) => (
              <div key={p.name}>
                <label htmlFor={`p-${p.name}`} className="label">
                  {p.label} <code className="text-xs text-muted">{p.name}</code>
                </label>
                {p.options ? (
                  <select id={`p-${p.name}`} className="input" value={values[p.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}>
                    {p.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input id={`p-${p.name}`} className="input" value={values[p.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))} />
                )}
              </div>
            ))}

            {selected.body === "file" && (
              <div>
                <label htmlFor="file" className="label">
                  Imagen o GIF (máx. 5 MB)
                </label>
                <input id="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="input py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Enviando…" : "Probar"}
            </button>
          </form>

          <div>
            <h3 className="label">curl</h3>
            <pre className="overflow-x-auto rounded-xl bg-surface2 p-3 text-xs">{curlFor(selected, values, base || "https://yuiapi.vercel.app")}</pre>
          </div>

          <div aria-live="polite">
            {result?.kind === "error" && (
              <p className="rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger" role="alert">
                {result.message}
              </p>
            )}
            {result && result.kind !== "error" && (
              <div className="space-y-2">
                <p className="text-sm text-muted">
                  Estado <strong className={result.status < 400 ? "text-ok" : "text-danger"}>{result.status}</strong>
                  {result.remaining !== null && <> · solicitudes restantes hoy: {result.remaining}</>}
                </p>
                {result.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.url} alt="Resultado de la API" className="checker max-h-80 rounded-xl border border-line" />
                ) : (
                  <pre className="max-h-96 overflow-auto rounded-xl bg-surface2 p-3 text-xs">{result.text}</pre>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
