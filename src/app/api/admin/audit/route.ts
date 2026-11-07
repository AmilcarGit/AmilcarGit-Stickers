import { json, requireUser, route } from "@/server/http";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  await requireUser(d, req, { admin: true });
  const rows = await d.store.zrange("admin:audit", 0, 99, true);
  const actions = rows.flatMap((raw) => {
    try { return [JSON.parse(raw) as { at: number; actor: string; target: string; action: string; detail: string }]; }
    catch { return []; }
  });
  return json({ actions });
});
