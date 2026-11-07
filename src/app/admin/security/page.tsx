"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { RequireAdmin } from "@/components/Guards";
import { useToast } from "@/components/Providers";
import { api } from "@/lib/api";

type SecurityEvent = { id: string; at: number; type: string; severity: "info" | "warning" | "critical"; ip: string; path: string; detail: string };
type IpBlock = { ip: string; reason: string; blockedAt: number; expiresAt: number };
type Snapshot = { events: SecurityEvent[]; blocks: IpBlock[] };

function SecurityInner() {
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<Snapshot>({ events: [], blocks: [] });
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("3600");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api<Snapshot>("/api/admin/security"));
    } catch (error) {
      toast(error instanceof Error ? error.message : "No se pudo cargar seguridad.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/admin/security", { method: "POST", body: { ip, reason, durationSeconds: Number(duration) } });
      setIp("");
      setReason("");
      toast("IP bloqueada correctamente.", "ok");
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "No se pudo bloquear la IP.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(value: string) {
    try {
      await api(`/api/admin/security/${encodeURIComponent(value)}`, { method: "DELETE" });
      toast("Bloqueo retirado.", "ok");
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "No se pudo retirar el bloqueo.", "error");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-accent hover:underline">← Volver al panel administrativo</Link>
          <h1 className="mt-2 text-3xl font-black">Centro de seguridad</h1>
          <p className="mt-1 text-sm text-muted">Monitorea intentos rechazados y administra bloqueos temporales de IP.</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:bg-surface2">Actualizar</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">Bloqueos activos</p><p className="mt-1 text-3xl font-black">{snapshot.blocks.length}</p></div>
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">Eventos recientes</p><p className="mt-1 text-3xl font-black">{snapshot.events.length}</p></div>
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">Retención de eventos</p><p className="mt-1 text-3xl font-black">300</p><p className="text-xs text-muted">Últimos eventos almacenados</p></div>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-bold">Bloquear una dirección IP</h2>
        <p className="mt-1 text-sm text-muted">El bloqueo afecta a las rutas públicas de la API v1. No bloquea el acceso al panel administrativo.</p>
        <form onSubmit={createBlock} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input required value={ip} onChange={(e) => setIp(e.target.value)} placeholder="Ej. 203.0.113.10 o 2001:db8::1" className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm" />
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm">
            <option value="600">10 minutos</option><option value="3600">1 hora</option><option value="21600">6 horas</option><option value="86400">24 horas</option><option value="604800">7 días</option><option value="2592000">30 días</option>
          </select>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="Motivo del bloqueo (opcional)" className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm sm:col-span-2" />
          <button disabled={saving} className="min-h-11 rounded-xl bg-violet-600 px-4 font-semibold text-white disabled:opacity-60 sm:col-span-2">{saving ? "Aplicando..." : "Bloquear IP"}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-bold">IPs bloqueadas</h2>
        {loading ? <p className="mt-3 text-sm text-muted">Cargando...</p> : snapshot.blocks.length === 0 ? <p className="mt-3 text-sm text-muted">No hay direcciones IP bloqueadas.</p> : (
          <div className="mt-3 space-y-2">{snapshot.blocks.map((block) => <div key={block.ip} className="flex flex-col gap-3 rounded-xl border border-line bg-bg/60 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all font-semibold">{block.ip}</p><p className="text-xs text-muted">{block.reason} · Expira: {new Date(block.expiresAt).toLocaleString("es-PE")}</p></div><button type="button" onClick={() => void removeBlock(block.ip)} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface2">Desbloquear</button></div>)}</div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-bold">Actividad de seguridad</h2>
        <p className="mt-1 text-sm text-muted">No se almacenan claves API ni contraseñas en estos registros.</p>
        {snapshot.events.length === 0 ? <p className="mt-3 text-sm text-muted">Todavía no hay eventos registrados.</p> : (
          <div className="mt-3 space-y-2">{snapshot.events.map((event) => <article key={event.id} className="rounded-xl border border-line bg-bg/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{event.type === "api_key_rejected" ? "Clave API rechazada" : event.type === "rate_limited" ? "Límite alcanzado" : event.type === "ip_blocked" ? "IP bloqueada" : "IP desbloqueada"}</span><span className="text-xs text-muted">{new Date(event.at).toLocaleString("es-PE")}</span></div><p className="mt-1 break-all text-sm text-muted">{event.ip} · {event.path}</p><p className="mt-1 text-sm">{event.detail}</p></article>)}</div>
        )}
      </section>
    </div>
  );
}

export default function SecurityPage() {
  return <RequireAdmin><SecurityInner /></RequireAdmin>;
}
