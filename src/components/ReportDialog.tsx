"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createReport } from "@/lib/data";
import { REPORT_REASONS, type Pack, type ReportReason } from "@/lib/types";
import { useAuth, useToast } from "./Providers";

export function ReportDialog({ pack, onClose }: { pack: Pack; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason>("copyright");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await createReport({ packId: pack.id, reason, details: details.trim() });
      toast("Reporte enviado. Un moderador lo revisará.", "ok");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo enviar el reporte.", "error");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={onClose}>
      <div className="card w-full max-w-md !bg-surface" onClick={(e) => e.stopPropagation()}>
        <h2 id="report-title" className="text-lg font-bold">
          Reportar «{pack.title}»
        </h2>
        {!user ? (
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-muted">Inicia sesión para enviar un reporte.</p>
            <Link href={`/login?next=${encodeURIComponent(`/p/${pack.id}`)}`} className="btn-primary">
              Iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4">
            <div>
              <label htmlFor="reason" className="label">
                Motivo
              </label>
              <select id="reason" ref={firstRef} className="input" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
                {REPORT_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="details" className="label">
                Detalles
              </label>
              <textarea id="details" className="input min-h-[96px] py-2" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Explica qué pasa y, si es tu obra, dónde está el original." />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Enviando…" : "Enviar reporte"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
