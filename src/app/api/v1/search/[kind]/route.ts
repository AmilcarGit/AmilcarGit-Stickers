import { AppError } from "@/server/errors";
import { cleanLimit, cleanQuery, searchAnime, searchBooks, searchMusic, searchOpenImages, searchWikipedia, searchShows, searchCharacters, searchCountries, searchPapers, searchEbooks } from "@/server/external";
import { preflight, v1With } from "@/server/v1";

export const runtime = "nodejs";
export const OPTIONS = preflight;

const KINDS = ["music", "anime", "wiki", "books", "images", "shows", "characters", "countries", "papers", "ebooks"] as const;

/** Búsqueda: /search/music | anime | wiki | books | images  con ?q= y ?limit= (wiki acepta ?lang=es). */
export const GET = v1With<{ kind: string }>(async ({ url }, { kind }) => {
  const query = cleanQuery(url.searchParams.get("q"));
  const limit = cleanLimit(url.searchParams.get("limit"));
  switch (kind) {
    case "music":
      return { query, results: await searchMusic(fetch, query, limit), note: "previewUrl es un fragmento oficial de 30 s, no la canción completa." };
    case "anime":
      return { query, results: await searchAnime(fetch, query, limit) };
    case "wiki":
      return { query, results: await searchWikipedia(fetch, query, limit, url.searchParams.get("lang") ?? "es") };
    case "books":
      return { query, results: await searchBooks(fetch, query, limit) };
    case "images":
      return { query, results: await searchOpenImages(fetch, query, limit), note: "Respeta el autor y la licencia de cada imagen." };
    default:
      throw new AppError(404, `Búsqueda desconocida. Usa: ${KINDS.join(", ")}.`);
  }
});
