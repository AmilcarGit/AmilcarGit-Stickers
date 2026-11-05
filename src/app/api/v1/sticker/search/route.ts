import { cleanLimit, cleanQuery, searchGiphyStickers } from "@/server/external";
import { preflight, v1 } from "@/server/v1";

export const runtime = "nodejs";
export const OPTIONS = preflight;

/** Stickers de Giphy (requiere GIPHY_API_KEY en el servidor). Atribución obligatoria: «Powered by GIPHY». */
export const GET = v1(async ({ url }) => {
  const query = cleanQuery(url.searchParams.get("q"));
  const results = await searchGiphyStickers(fetch, process.env.GIPHY_API_KEY, query, cleanLimit(url.searchParams.get("limit")));
  return { query, total: results.length, results, attribution: "Powered by GIPHY" };
});
