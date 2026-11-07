import { hit } from "@/server/store";
import { AppError } from "@/server/errors";
import { json, route } from "@/server/http";
import { monthlyRanking } from "@/server/profile";

export const runtime = "nodejs";

/** Ranking público del mes: solo usuario visible, nombre, foto y número de solicitudes. */
export const GET = route(async ({ d, ip }) => {
  if (!(await hit(d.store, `rl:ranking:${ip}`, 60, 60))) throw new AppError(429, "Demasiadas consultas. Espera un momento.");
  return json(await monthlyRanking(d), 200, { "cache-control": "public, max-age=30" });
});
