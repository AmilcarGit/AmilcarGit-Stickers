import { json, readJson, requireUser, route } from "@/server/http";
import { listPublicPacks, publishPack } from "@/server/packs";

export const runtime = "nodejs";

export const GET = route(async ({ d }) => json({ packs: await listPublicPacks(d) }));

export const POST = route(async ({ d, req }) => {
  const { user } = await requireUser(d, req, { verified: true });
  const pack = await publishPack(d, user, await readJson(req, 200_000));
  return json({ pack }, 201);
});
