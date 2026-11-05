import { preflight, v1 } from "@/server/v1";

export const runtime = "nodejs";
export const OPTIONS = preflight;

/** Estado de tu clave: plan y solicitudes restantes de hoy (esta consulta también descuenta 1). */
export const GET = v1(async ({ user, quota }) => ({
  user: { username: user.username, plan: quota.plan },
  quota: { limit: quota.limit, used: quota.used, remaining: quota.remaining, resetAt: new Date(quota.resetAt).toISOString() },
}));
