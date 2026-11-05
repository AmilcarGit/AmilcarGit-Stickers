import { createApiKey, listApiKeys, quotaFor } from "@/server/apikeys";
import { json, readJson, requireUser, route } from "@/server/http";

export const runtime = "nodejs";

export const GET = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  const [keys, quota] = await Promise.all([listApiKeys(d, user.uid), quotaFor(d, user)]);
  return json({ keys, quota });
});

export const POST = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req);
  const b = await readJson(req, 1_000);
  const { key, info } = await createApiKey(d, user, b.name);
  return json({ key, info }, 201);
});
