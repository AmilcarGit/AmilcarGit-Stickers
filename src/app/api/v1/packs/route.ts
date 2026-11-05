import { cleanLimit } from "@/server/external";
import { publicPack, searchPacks } from "@/server/packs";
import { preflight, v1 } from "@/server/v1";

export const runtime = "nodejs";
export const OPTIONS = preflight;

/** Paquetes públicos de la comunidad. Filtros: ?q= (título, etiquetas, autor), ?category=, ?limit=, ?offset= */
export const GET = v1(async ({ d, url }) => {
  const limit = cleanLimit(url.searchParams.get("limit"), 20, 50);
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "", 10) || 0);
  const { total, packs } = await searchPacks(d, { q: url.searchParams.get("q") ?? "", category: url.searchParams.get("category") ?? "", limit, offset });
  return { total, offset, packs: packs.map((p) => publicPack(p, d.siteUrl)) };
});
