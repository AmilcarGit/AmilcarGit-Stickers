"use client";

import { useCallback, useEffect, useState } from "react";

type EndpointMetric = { path: string; requests: number; errors: number; averageMs: number; p95Ms: number; errorRate: number };
type Metrics = { scope: "instance"; windowSeconds: number; collectedAt: number; totalRequests: number; requestsPerMinute: number; errors: number; averageMs: number; p95Ms: number; endpoints: EndpointMetric[] };

function metric(value: number) {
  return `${Math.round(value).toLocaleString("es-PE")} ms`;
}

export function AdminPerformance() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/performance", { cache: "no-store" });
      const result = await response.json() as Metrics & { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudieron consultar las métricas.");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron consultar las métricas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const maxP95 = Math.max(1, ...(data?.endpoints.map((item) => item.p95Ms) ?? [1]));

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 via-surface/90 to-violet-500/5 p-4 shadow-xl shadow-black/10 sm:p-5" aria-labelledby="performance-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.8)]" /><span className="text-[10px] font-extrabold tracking-[.18em] text-cyan-200">OBSERVABILIDAD</span></div>
          <h2 id="performance-heading" className="mt-1 text-lg font-bold">Rendimiento de YuiAPI</h2>
          <p className="mt-1 text-xs text-muted">Ventana móvil de 5 minutos · datos de esta instancia de ejecución</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="min-h-10 rounded-xl border border-line bg-surface/80 px-3 text-xs font-semibold text-ink transition hover:border-cyan-300/50 disabled:opacity-50">{loading ? "Actualizando…" : "Actualizar métricas"}</button>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
      {data ? <>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <article className="rounded-xl border border-line/80 bg-bg/55 p-3"><p className="text-[10px] font-semibold text-muted">Solicitudes (5 min)</p><strong className="mt-1 block text-2xl tabular-nums">{data.totalRequests.toLocaleString("es-PE")}</strong></article>
          <article className="rounded-xl border border-line/80 bg-bg/55 p-3"><p className="text-[10px] font-semibold text-muted">Último minuto</p><strong className="mt-1 block text-2xl tabular-nums">{data.requestsPerMinute.toLocaleString("es-PE")}</strong></article>
          <article className="rounded-xl border border-line/80 bg-bg/55 p-3"><p className="text-[10px] font-semibold text-muted">Latencia media</p><strong className="mt-1 block text-2xl tabular-nums">{metric(data.averageMs)}</strong></article>
          <article className="rounded-xl border border-line/80 bg-bg/55 p-3"><p className="text-[10px] font-semibold text-muted">Errores HTTP</p><strong className="mt-1 block text-2xl tabular-nums">{data.errors.toLocaleString("es-PE")}</strong><span className="text-[10px] text-muted">P95: {metric(data.p95Ms)}</span></article>
        </div>
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Endpoints con mayor latencia P95</h3>
          {data.endpoints.length ? <ul className="mt-2 space-y-3">
            {data.endpoints.slice(0, 6).map((item) => <li key={item.path}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><code className="break-all text-ink">{item.path}</code><span className="tabular-nums text-muted">{metric(item.p95Ms)} · {item.requests} req. · {item.errorRate}% errores</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg"><span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${Math.max(2, item.p95Ms / maxP95 * 100)}%` }} /></div>
            </li>)}
          </ul> : <p className="mt-3 text-sm text-muted">Todavía no hay solicitudes registradas en esta instancia.</p>}
        </div>
        <p className="mt-4 border-t border-line/70 pt-3 text-[11px] leading-relaxed text-muted">Nota: Vercel puede ejecutar varias instancias independientes. Estas métricas son locales a la instancia que atendió esta consulta; no representan un agregado global ni histórico de toda la plataforma.</p>
      </> : loading ? <p className="mt-4 text-sm text-muted">Recopilando métricas…</p> : null}
    </section>
  );
}
