import { AppError } from "./errors";

/** Proveedores externos LEGALES y con API pública: cada función recibe `fetch` para poder probarse sin red. */
export type Fetcher = typeof fetch;

const MAX_BODY = 1_500_000;
const UA = "YuiApi/1.0 (+https://yuiapi.vercel.app)";

async function getJson(fetcher: Fetcher, url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new AppError(502, "El servicio externo no respondió a tiempo. Inténtalo otra vez.");
  }
  if (res.status === 429) throw new AppError(503, "El servicio externo está limitando las consultas. Inténtalo en unos minutos.");
  if (!res.ok) throw new AppError(502, "El servicio externo devolvió un error.");
  const text = await res.text();
  if (text.length > MAX_BODY) throw new AppError(502, "La respuesta del servicio externo es demasiado grande.");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(502, "El servicio externo devolvió datos no válidos.");
  }
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const q = (s: string) => encodeURIComponent(s);

export function cleanQuery(raw: string | null, max = 100): string {
  const text = (raw ?? "").trim().slice(0, max);
  if (!text) throw new AppError(400, "Falta el parámetro «q» con lo que quieres buscar.");
  return text;
}

export function cleanLimit(raw: string | null, def = 10, max = 25): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(1, n)) : def;
}

/** Stickers de Giphy. Requiere tu propia clave (GIPHY_API_KEY); Giphy pide mostrar «Powered by GIPHY». */
export async function searchGiphyStickers(f: Fetcher, apiKey: string | undefined, query: string, limit: number) {
  if (!apiKey) throw new AppError(503, "La búsqueda en Giphy no está configurada en el servidor.");
  const data = obj(await getJson(f, `https://api.giphy.com/v1/stickers/search?api_key=${q(apiKey)}&q=${q(query)}&limit=${limit}&rating=pg-13`));
  return arr(data.data).map((raw) => {
    const it = obj(raw);
    const images = obj(it.images);
    const original = obj(images.original);
    return {
      id: str(it.id),
      title: str(it.title),
      gif: str(original.url),
      webp: str(original.webp),
      page: str(it.url),
    };
  });
}

export async function searchMusic(f: Fetcher, query: string, limit: number) {
  const data = obj(await getJson(f, `https://itunes.apple.com/search?term=${q(query)}&media=music&entity=song&limit=${limit}`));
  return arr(data.results).map((raw) => {
    const r = obj(raw);
    return {
      id: num(r.trackId),
      title: str(r.trackName),
      artist: str(r.artistName),
      album: str(r.collectionName),
      genre: str(r.primaryGenreName),
      durationMs: num(r.trackTimeMillis),
      releaseDate: str(r.releaseDate),
      cover: str(r.artworkUrl100),
      /** Fragmento oficial de 30 s que ofrece Apple; no es la canción completa. */
      previewUrl: str(r.previewUrl),
      url: str(r.trackViewUrl),
    };
  });
}

export async function searchAnime(f: Fetcher, query: string, limit: number) {
  const data = obj(await getJson(f, `https://api.jikan.moe/v4/anime?q=${q(query)}&limit=${limit}&sfw=true`));
  return arr(data.data).map((raw) => {
    const r = obj(raw);
    const jpg = obj(obj(r.images).jpg);
    return {
      id: num(r.mal_id),
      title: str(r.title),
      titleEnglish: str(r.title_english),
      type: str(r.type),
      episodes: num(r.episodes),
      status: str(r.status),
      score: num(r.score),
      year: num(r.year),
      synopsis: str(r.synopsis),
      image: str(jpg.image_url),
      url: str(r.url),
    };
  });
}

export async function searchWikipedia(f: Fetcher, query: string, limit: number, lang = "es") {
  if (!/^[a-z]{2,3}$/.test(lang)) throw new AppError(400, "Idioma no válido (usa un código como es, en o pt).");
  const data = obj(await getJson(f, `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${q(query)}&limit=${limit}`));
  return arr(data.pages).map((raw) => {
    const r = obj(raw);
    const thumb = obj(r.thumbnail);
    const key = str(r.key);
    const thumbUrl = str(thumb.url);
    return {
      id: num(r.id),
      title: str(r.title),
      description: str(r.description),
      excerpt: str(r.excerpt)?.replace(/<[^>]+>/g, "") ?? null,
      thumbnail: thumbUrl ? (thumbUrl.startsWith("//") ? `https:${thumbUrl}` : thumbUrl) : null,
      url: key ? `https://${lang}.wikipedia.org/wiki/${q(key)}` : null,
    };
  });
}

export async function searchBooks(f: Fetcher, query: string, limit: number) {
  const data = obj(
    await getJson(f, `https://openlibrary.org/search.json?q=${q(query)}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,language`),
  );
  return arr(data.docs).map((raw) => {
    const r = obj(raw);
    const cover = num(r.cover_i);
    const key = str(r.key);
    return {
      title: str(r.title),
      authors: arr(r.author_name).filter((a): a is string => typeof a === "string"),
      firstPublishYear: num(r.first_publish_year),
      pages: num(r.number_of_pages_median),
      cover: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : null,
      url: key ? `https://openlibrary.org${key}` : null,
    };
  });
}

/** Imágenes con licencia abierta (Openverse). Cada resultado trae autor y licencia: respétalos al usarlas. */
export async function searchOpenImages(f: Fetcher, query: string, limit: number) {
  const data = obj(await getJson(f, `https://api.openverse.org/v1/images/?q=${q(query)}&page_size=${limit}&mature=false`));
  return arr(data.results).map((raw) => {
    const r = obj(raw);
    return {
      id: str(r.id),
      title: str(r.title),
      image: str(r.url),
      thumbnail: str(r.thumbnail),
      creator: str(r.creator),
      license: str(r.license),
      licenseVersion: str(r.license_version),
      licenseUrl: str(r.license_url),
      source: str(r.source),
      page: str(r.foreign_landing_url),
    };
  });
}
