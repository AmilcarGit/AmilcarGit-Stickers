import { REPORT_REASONS, type Report } from "@/lib/types";
import type { Deps } from "./deps";
import { AppError } from "./errors";
import { removeForModeration } from "./packs";
import { hit } from "./store";
import { newId } from "./tokens";

type PackLite = { id: string; title: string };

export async function createReport(d: Deps, reporterId: string, raw: Record<string, unknown>): Promise<void> {
  if (!(await hit(d.store, `rl:report:${reporterId}`, 10, 3600))) throw new AppError(429, "Enviaste muchos reportes seguidos. Espera un rato.");
  const packId = typeof raw.packId === "string" ? raw.packId : "";
  const reason = REPORT_REASONS.find((r) => r.id === raw.reason)?.id;
  if (!reason) throw new AppError(400, "Elige un motivo.");
  const pack = packId ? await d.store.get<PackLite>(`pack:${packId}`) : null;
  if (!pack) throw new AppError(404, "Paquete no encontrado.");

  const report: Report = {
    id: newId("r"),
    packId,
    packTitle: pack.title,
    reporterId,
    reason,
    details: typeof raw.details === "string" ? raw.details.trim().slice(0, 1000) : "",
    status: "open",
    createdAt: Date.now(),
  };
  await d.store.set(`report:${report.id}`, report);
  await d.store.zadd("reports:open", report.createdAt, report.id);
}

export async function listOpenReports(d: Deps): Promise<Report[]> {
  const ids = await d.store.zrange("reports:open", 0, 99, true);
  const recs = await d.store.mget<Report>(ids.map((i) => `report:${i}`));
  return recs.filter((r): r is Report => r !== null);
}

/** Tras revisar: retira el paquete o descarta el reporte. */
export async function resolveReport(d: Deps, id: string, action: unknown): Promise<void> {
  if (action !== "removed" && action !== "dismissed") throw new AppError(400, "Acción no válida.");
  const report = await d.store.get<Report>(`report:${id}`);
  if (!report) throw new AppError(404, "Reporte no encontrado.");
  if (action === "removed") await removeForModeration(d, report.packId);
  await d.store.set(`report:${id}`, { ...report, status: action });
  await d.store.zrem("reports:open", id);
}
