import { AppError } from "./errors";

/** Proveedores externos LEGALES y con API pública: cada función recibe `fetch` para poder probarse sin red. */
export type Fetcher = typeof fetch;

const MAX_BODY = 1_500_000;
const UA = "YuiApi/1.0 (+https://yuiapi.vercel.app)";

async function getJson(fetcher: Fetcher, url: string, allowNotFound = false): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new AppError(502, "El servicio externo no respondió a tiempo. Inténtalo otra vez.");
  }
  if (res.status === 429) throw new AppError(503, "El servicio externo está limitando las consultas. Inténtalo en unos minutos.");
  if (res.status === 404 && allowNotFound) return null;
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


async function getHtml(fetcher: Fetcher, url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; YuiAPI/1.0)", accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
  } catch {
    throw new AppError(502, "El servicio de búsqueda no respondió a tiempo. Inténtalo otra vez.");
  }
  if (response.status === 429) throw new AppError(503, "El servicio de búsqueda está limitando las consultas. Inténtalo más tarde.");
  if (!response.ok) throw new AppError(502, "El servicio de búsqueda devolvió un error.");
  const html = await response.text();
  if (html.length > MAX_BODY) throw new AppError(502, "La respuesta del servicio de búsqueda es demasiado grande.");
  return html;
}

function parseEmbeddedJson(html: string, marker: string): unknown | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function collectObjects(root: unknown, predicate: (value: Record<string, unknown>) => boolean, max = 30_000) {
  const found: Record<string, unknown>[] = [];
  const stack: unknown[] = [root];
  let visited = 0;
  while (stack.length && visited++ < max) {
    const value = stack.pop();
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) stack.push(...value);
    else {
      const record = value as Record<string, unknown>;
      if (predicate(record)) found.push(record);
      stack.push(...Object.values(record));
    }
  }
  return found;
}

/** Búsqueda pública de YouTube. Los enlaces apuntan al video original; no descarga ni reproduce contenido protegido. */
export async function searchYouTube(f: Fetcher, query: string, limit: number) {
  const html = await getHtml(f, `https://www.youtube.com/results?search_query=${q(query)}`);
  const data = parseEmbeddedJson(html, "var ytInitialData =") ?? parseEmbeddedJson(html, "ytInitialData =");
  if (!data) throw new AppError(502, "YouTube no entregó resultados de búsqueda. Inténtalo más tarde.");
  const videos = collectObjects(data, (item) => typeof item.videoId === "string" && !!item.title && !!item.thumbnail)
    .filter((item) => {
      const badges = arr(item.badges).map((badge) => JSON.stringify(badge)).join(" ");
      return !badges.includes("LIVE_NOW");
    });
  const seen = new Set<string>();
  return videos.flatMap((item) => {
    const id = str(item.videoId);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const titleNode = obj(item.title);
    const title = arr(titleNode.runs).map((part) => str(obj(part).text)).filter(Boolean).join("") || str(titleNode.simpleText);
    const thumbs = arr(obj(item.thumbnail).thumbnails);
    const thumbnail = str(obj(thumbs[thumbs.length - 1]).url);
    const owner = obj(item.ownerText);
    const channel = arr(owner.runs).map((part) => str(obj(part).text)).filter(Boolean).join("") || str(owner.simpleText);
    const duration = str(obj(item.lengthText).simpleText);
    const views = str(obj(item.viewCountText).simpleText);
    const published = str(obj(item.publishedTimeText).simpleText);
    return [{ id, title, channel, duration, views, published, thumbnail, url: `https://www.youtube.com/watch?v=${id}` }];
  }).slice(0, limit);
}

/** Búsqueda pública de Pinterest. Los resultados enlazan al Pin; disponibilidad de metadatos depende de Pinterest. */
export async function searchPinterest(f: Fetcher, query: string, limit: number) {
  const html = await getHtml(f, `https://www.pinterest.com/search/pins/?q=${q(query)}`);
  const pins = collectObjects(parseEmbeddedJson(html, "window.__PWS_DATA__ =") ?? parseEmbeddedJson(html, "PWS_DATA =") ?? {}, (item) => {
    const id = str(item.id) ?? str(item.pin_id);
    const images = obj(item.images);
    return !!id && !!(str(item.title) || str(item.grid_title) || Object.keys(images).length);
  });
  const results = pins.flatMap((item) => {
    const id = str(item.id) ?? str(item.pin_id);
    if (!id || !/^\\d+$/.test(id)) return [];
    const images = obj(item.images);
    const image = obj(images.orig).url ?? obj(images["736x"]).url ?? obj(images["474x"]).url;
    const imageUrl = str(image);
    const title = str(item.title) ?? str(item.grid_title) ?? str(item.description);
    return [{ id, title, image: imageUrl, url: `https://www.pinterest.com/pin/${id}/` }];
  });
  const unique = [...new Map(results.map((item) => [item.id, item])).values()];
  if (unique.length) return unique.slice(0, limit);

  // Fallback HTML: conserva solo pares de enlaces públicos de Pin e imágenes alojadas en pinimg.com.
  const ids = [...html.matchAll(/\/pin\/(\d+)\//g)].map((match) => match[1]);
  const images = [...html.matchAll(/https?:\/\/i\.pinimg\.com\/[^"\\\s]+/g)].map((match) => match[0].replace(/\\u002F/g, "/").replace(/\\u003D/g, "="));
  const fallback = [...new Map(ids.map((id, index) => [id, {
    id, title: null, image: images[index] ?? null, url: `https://www.pinterest.com/pin/${id}/`,
  }])).values()];
  if (!fallback.length) throw new AppError(502, "Pinterest no expuso resultados públicos para esta búsqueda. Prueba con otras palabras.");
  return fallback.slice(0, limit);
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


/** Series y programas mediante la API pública gratuita de TVmaze (con atribución CC BY-SA). */
export async function searchShows(f: Fetcher, query: string, limit: number) {
  const data = arr(await getJson(f, `https://api.tvmaze.com/search/shows?q=${q(query)}`));
  return data.slice(0, limit).map((raw) => {
    const item = obj(raw);
    const show = obj(item.show);
    const image = obj(show.image);
    const genres = arr(show.genres).filter((v): v is string => typeof v === "string");
    return {
      id: num(show.id),
      title: str(show.name),
      type: str(show.type),
      language: str(show.language),
      genres,
      status: str(show.status),
      premiered: str(show.premiered),
      summary: str(show.summary)?.replace(/<[^>]+>/g, "") ?? null,
      image: str(image.medium) ?? str(image.original),
      url: str(show.url),
      score: num(item.score),
    };
  });
}

/** Personajes de Rick and Morty; API pública sin clave. */
export async function searchCharacters(f: Fetcher, query: string, limit: number) {
  const data = obj(await getJson(f, `https://rickandmortyapi.com/api/character/?name=${q(query)}`, true));
  return arr(data.results).slice(0, limit).map((raw) => {
    const r = obj(raw);
    const origin = obj(r.origin);
    const location = obj(r.location);
    return {
      id: num(r.id),
      name: str(r.name),
      status: str(r.status),
      species: str(r.species),
      type: str(r.type),
      gender: str(r.gender),
      origin: str(origin.name),
      location: str(location.name),
      image: str(r.image),
      url: str(r.url),
    };
  });
}

/** Países y territorios mediante REST Countries v3.1, sin API key. */
export async function searchCountries(f: Fetcher, query: string, limit: number) {
  const data = arr(await getJson(f, `https://restcountries.com/v3.1/name/${q(query)}?fields=name,capital,region,subregion,population,cca2,cca3,flags,languages,currencies`, true));
  return data.slice(0, limit).map((raw) => {
    const r = obj(raw);
    const name = obj(r.name);
    const flags = obj(r.flags);
    const currencies = obj(r.currencies);
    const languages = obj(r.languages);
    return {
      code: str(r.cca2),
      name: str(name.common),
      officialName: str(name.official),
      capital: arr(r.capital).filter((v): v is string => typeof v === "string"),
      region: str(r.region),
      subregion: str(r.subregion),
      population: num(r.population),
      flag: str(flags.png) ?? str(flags.svg),
      languages: Object.values(languages).filter((v): v is string => typeof v === "string"),
      currencies: Object.entries(currencies).map(([code, value]) => ({ code, name: str(obj(value).name), symbol: str(obj(value).symbol) })),
    };
  });
}

/** Publicaciones científicas y DOI mediante Crossref REST API, sin registro ni clave. */
export async function searchPapers(f: Fetcher, query: string, limit: number) {
  const data = obj(await getJson(f, `https://api.crossref.org/works?query.bibliographic=${q(query)}&rows=${limit}`));
  const message = obj(data.message);
  return arr(message.items).map((raw) => {
    const r = obj(raw);
    const authors = arr(r.author).map((author) => {
      const a = obj(author);
      return [str(a.given), str(a.family)].filter(Boolean).join(" ") || null;
    }).filter((v): v is string => Boolean(v));
    const title = arr(r.title);
    const published = obj(r.published);
    const dateParts = arr(published["date-parts"]);
    const firstDate = arr(dateParts[0]);
    return {
      title: str(title[0]),
      authors,
      publisher: str(r.publisher),
      journal: str(arr(r["container-title"])[0]),
      year: num(firstDate[0]),
      doi: str(r.DOI),
      url: str(r.URL),
      type: str(r.type),
    };
  });
}

/** Libros de dominio público del catálogo Gutendex / Project Gutenberg, sin clave. */
export async function searchEbooks(f: Fetcher, query: string, limit: number) {
  const data = obj(await getJson(f, `https://gutendex.com/books/?search=${q(query)}`));
  return arr(data.results).slice(0, limit).map((raw) => {
    const r = obj(raw);
    const formats = obj(r.formats);
    const authors = arr(r.authors).map((author) => {
      const a = obj(author);
      return str(a.name);
    }).filter((v): v is string => Boolean(v));
    return {
      id: num(r.id),
      title: str(r.title),
      authors,
      languages: arr(r.languages).filter((v): v is string => typeof v === "string"),
      subjects: arr(r.subjects).filter((v): v is string => typeof v === "string").slice(0, 8),
      downloads: num(r.download_count),
      cover: str(formats["image/jpeg"]),
      textHtml: str(formats["text/html"]),
      epub: str(formats["application/epub+zip"]),
      plainText: str(formats["text/plain; charset=utf-8"]) ?? str(formats["text/plain"]),
    };
  });
}
