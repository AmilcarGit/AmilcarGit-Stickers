"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RequireAdmin } from "@/components/Guards";
import { useToast } from "@/components/Providers";
import { listOpenReports, resolveReport } from "@/lib/data";
import { REPORT_REASONS, type Report } from "@/lib/types";

function AdminInner() {
  const toast = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setReports(await listOpenReports());
    } catch {
      toast("No se pudieron cargar los reportes.", "error");
    }
    setLoaded(true);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(r: Report, action: "removed" | "dismissed") {
    if (action === "removed" && !confirm(`¿Retirar el paquete «${r.packTitle}»?`)) return;
    try {
      await resolveReport(r, action);
      setReports((list) => list.filter((x) => x.id !== r.id));
      toast(action === "removed" ? "Paquete retirado." : "Reporte descartado.", "ok");
    } catch {
      toast("No se pudo completar la acción.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Moderación</h1>
      <p className="text-muted">Reportes abiertos. Revisa el paquete antes de decidir.</p>
      {!loaded ? (
        <p className="text-muted">Cargando…</p>
      ) : reports.length === 0 ? (
        <div className="card text-muted">No hay reportes pendientes. 🎉</div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/p/${r.packId}`} className="font-semibold text-brand hover:underline" target="_blank">
                  {r.packTitle}
                </Link>
                <span className="chip !min-h-[28px] text-xs">{REPORT_REASONS.find((x) => x.id === r.reason)?.label ?? r.reason}</span>
              </div>
              {r.details && <p className="whitespace-pre-wrap text-sm text-muted">{r.details}</p>}
              <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleString("es")}</p>
              <div className="flex gap-2">
                <button type="button" className="btn-danger" onClick={() => resolve(r, "removed")}>
                  Retirar paquete
                </button>
                <button type="button" className="btn-ghost" onClick={() => resolve(r, "dismissed")}>
                  Descartar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAdmin>
      <AdminInner />
    </RequireAdmin>
  );
}
