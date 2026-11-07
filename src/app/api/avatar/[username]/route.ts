import { json, routeWith } from "@/server/http";
import { avatarByUsername } from "@/server/profile";

export const runtime = "nodejs";

/** Foto pública de un usuario (WebP 256x256). 404 si no tiene. */
export const GET = routeWith<{ username: string }>(async ({ d }, { username }) => {
  const bytes = await avatarByUsername(d, username);
  if (!bytes) return json({ error: "Sin foto." }, 404);
  return new Response(bytes as unknown as BodyInit, {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
});
