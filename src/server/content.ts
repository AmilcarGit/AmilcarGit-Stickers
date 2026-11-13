import { AppError } from "./errors";

export type ContentFetcher = typeof fetch;

const UA = "YuiAPI/1.0 (+https://yuiapi.vercel.app)";

async function json(fetcher: ContentFetcher, url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
  } catch {
    throw new AppError(502, "El proveedor de contenido no respondió a tiempo.");
  }
  if (response.status === 429) throw new AppError(503, "El proveedor está limitando las consultas. Inténtalo más tarde.");
  if (!response.ok) throw new AppError(502, "El proveedor de contenido devolvió un error.");
  const raw = await response.text();
  if (raw.length > 1_500_000) throw new AppError(502, "La respuesta del proveedor supera el tamaño permitido.");
  try { return JSON.parse(raw) as unknown; } catch { throw new AppError(502, "El proveedor devolvió JSON no válido."); }
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const encode = (value: string) => encodeURIComponent(value);

export async function dragonBallCharacters(fetcher: ContentFetcher, query: string | null, limit: number) {
  const params = new URLSearchParams({ page: "1", limit: String(limit) });
  if (query) params.set("name", query);
  const payload = record(await json(fetcher, `https://dragonball-api.com/api/characters?${params}`));
  const raw = list(payload.items).length ? list(payload.items) : list(payload.data);
  return raw.slice(0, limit).map((item) => {
    const c = record(item);
    const race = record(c.race);
    const affiliation = record(c.affiliation);
    const originPlanet = record(c.originPlanet);
    const transformations = list(c.transformations).map((value) => {
      const t = record(value);
      return { id: number(t.id), name: string(t.name), image: string(t.image), ki: string(t.ki) };
    });
    return {
      id: number(c.id),
      name: string(c.name),
      ki: string(c.ki),
      maxKi: string(c.maxKi),
      race: string(c.race) ?? string(race.name),
      gender: string(c.gender),
      description: string(c.description),
      image: string(c.image),
      affiliation: string(c.affiliation) ?? string(affiliation.name),
      originPlanet: string(originPlanet.name),
      transformations,
    };
  }).filter((item) => item.id !== null && item.name !== null);
}

export async function dragonBallCharacter(fetcher: ContentFetcher, id: string) {
  if (!/^\\d{1,6}$/.test(id)) throw new AppError(400, "El id del personaje debe ser numérico.");
  const c = record(await json(fetcher, `https://dragonball-api.com/api/characters/${id}`));
  if (!Object.keys(c).length) throw new AppError(404, "No se encontró el personaje de Dragon Ball.");
  return c;
}

export async function dragonBallPlanets(fetcher: ContentFetcher, limit: number) {
  const payload = record(await json(fetcher, `https://dragonball-api.com/api/planets?page=1&limit=${limit}`));
  const raw = list(payload.items).length ? list(payload.items) : list(payload.data);
  return raw.slice(0, limit).map((item) => {
    const p = record(item);
    return {
      id: number(p.id),
      name: string(p.name),
      isDestroyed: typeof p.isDestroyed === "boolean" ? p.isDestroyed : null,
      description: string(p.description),
      image: string(p.image),
      characters: list(p.characters).map((v) => {
        const c = record(v);
        return { id: number(c.id), name: string(c.name) };
      }),
    };
  });
}

const QUOTES = [
  { text: "El límite lo decides tú; cada intento puede acercarte a superarlo.", author: "YuiAPI" },
  { text: "La constancia convierte los pequeños avances en resultados.", author: "YuiAPI" },
  { text: "Aprender también significa corregir el camino.", author: "YuiAPI" },
  { text: "No necesitas hacerlo perfecto; necesitas empezar y mejorar.", author: "YuiAPI" },
];
const FACTS = [
  "Los pulpos tienen tres corazones y sangre azul.",
  "Un día en Venus dura más que su año.",
  "La miel bien almacenada puede conservarse durante muchísimo tiempo.",
  "Los tiburones existen desde antes que los árboles.",
];
const JOKES = [
  "¿Qué hace una abeja en el gimnasio? ¡Zum-ba!",
  "¿Por qué el programador confundió Halloween con Navidad? Porque OCT 31 = DEC 25.",
  "¿Qué le dijo un bit al otro? Nos vemos en el bus.",
  "¿Cuál es el colmo de un bot? Que nadie le responda.",
];

export async function randomContent(fetcher: ContentFetcher, kind: string) {
  switch (kind) {
    case "quote":
      return { ...QUOTES[Math.floor(Math.random() * QUOTES.length)], source: "YuiAPI · colección propia" };
    case "fact":
      return { text: FACTS[Math.floor(Math.random() * FACTS.length)], source: "YuiAPI · colección propia" };
    case "joke":
      return { text: JOKES[Math.floor(Math.random() * JOKES.length)], source: "YuiAPI · colección propia" };
    case "anime": {
      const payload = record(await json(fetcher, "https://api.jikan.moe/v4/random/anime"));
      const a = record(payload.data);
      return { id: number(a.mal_id), title: string(a.title), titleEnglish: string(a.title_english), synopsis: string(a.synopsis), score: number(a.score), image: string(record(record(a.images).jpg).image_url), url: string(a.url), source: "Jikan / MyAnimeList" };
    }
    case "meme": {
      const payload = record(await json(fetcher, "https://meme-api.com/gimme"));
      const post = record(payload);
      const image = string(post.url);
      if (!image || !/^https:\/\//.test(image)) throw new AppError(502, "El proveedor no devolvió una imagen válida.");
      return { title: string(post.title), image, postUrl: string(post.postLink), subreddit: string(post.subreddit), source: "Meme API / Reddit" };
    }
    case "waifu": {
      const payload = record(await json(fetcher, "https://api.waifu.pics/sfw/waifu"));
      const image = string(payload.url);
      if (!image || !/^https:\/\//.test(image)) throw new AppError(502, "El proveedor no devolvió una imagen válida.");
      return { image, source: "waifu.pics" };
    }
    case "wallpaper":
    case "cosplay": {
      const term = kind === "wallpaper" ? "anime wallpaper" : "cosplay";
      const payload = record(await json(fetcher, `https://api.openverse.org/v1/images/?q=${encode(term)}&page_size=20&mature=false`));
      const results = list(payload.results).map((v) => {
        const r = record(v);
        return { id: string(r.id), title: string(r.title), image: string(r.url), thumbnail: string(r.thumbnail), creator: string(r.creator), license: string(r.license), licenseUrl: string(r.license_url), page: string(r.foreign_landing_url) };
      }).filter((v) => v.image && v.license);
      if (!results.length) throw new AppError(404, "No se encontraron imágenes con licencia identificable.");
      return { ...results[Math.floor(Math.random() * results.length)], source: "Openverse", note: "Comprueba las condiciones de la licencia antes de reutilizar la imagen." };
    }
    default:
      throw new AppError(404, "Contenido aleatorio no disponible. Usa anime, meme, wallpaper, waifu, quote, fact, joke o cosplay.");
  }
}
