/** Catálogo de endpoints de la API v1: lo usan la documentación y el explorador. */
export type Param = { name: string; label: string; example: string; options?: string[] };
export type Endpoint = {
  id: string;
  group: "Stickers" | "Búsqueda" | "Herramientas" | "Cuenta";
  method: "GET" | "POST";
  path: string;
  what: string;
  params: Param[];
  /** «file»: el cuerpo es una imagen que la persona elige. «image»: la respuesta es una imagen. */
  body?: "file";
  returns: "json" | "image";
};

const q = (example: string): Param => ({ name: "q", label: "Búsqueda", example });
const limit: Param = { name: "limit", label: "Límite", example: "5" };

export const ENDPOINTS: Endpoint[] = [
  {
    id: "sticker-convert",
    group: "Stickers",
    method: "POST",
    path: "/api/v1/sticker",
    what: "Convierte una imagen o GIF en un sticker de WhatsApp (WebP 512×512, transparente, dentro del peso permitido).",
    params: [
      { name: "fit", label: "Ajuste", example: "contain", options: ["contain", "cover"] },
      { name: "quality", label: "Calidad (10-100)", example: "80" },
    ],
    body: "file",
    returns: "image",
  },
  {
    id: "sticker-search",
    group: "Stickers",
    method: "GET",
    path: "/api/v1/sticker/search",
    what: "Busca stickers en Giphy (el servidor necesita GIPHY_API_KEY; muestra «Powered by GIPHY»).",
    params: [q("gato"), limit],
    returns: "json",
  },
  {
    id: "music",
    group: "Búsqueda",
    method: "GET",
    path: "/api/v1/search/music",
    what: "Canciones (Apple iTunes Search) con un fragmento oficial de 30 s, no la canción completa.",
    params: [q("Daft Punk"), limit],
    returns: "json",
  },
  {
    id: "anime",
    group: "Búsqueda",
    method: "GET",
    path: "/api/v1/search/anime",
    what: "Anime (Jikan / MyAnimeList).",
    params: [q("Naruto"), limit],
    returns: "json",
  },
  {
    id: "wiki",
    group: "Búsqueda",
    method: "GET",
    path: "/api/v1/search/wiki",
    what: "Artículos de Wikipedia con resumen.",
    params: [q("Machu Picchu"), { name: "lang", label: "Idioma", example: "es" }, limit],
    returns: "json",
  },
  {
    id: "books",
    group: "Búsqueda",
    method: "GET",
    path: "/api/v1/search/books",
    what: "Libros (Open Library).",
    params: [q("Cien años de soledad"), limit],
    returns: "json",
  },
  {
    id: "images",
    group: "Búsqueda",
    method: "GET",
    path: "/api/v1/search/images",
    what: "Imágenes con licencia abierta (Openverse), con autor y licencia.",
    params: [q("sakura"), limit],
    returns: "json",
  },
  {
    id: "qr",
    group: "Herramientas",
    method: "GET",
    path: "/api/v1/tools/qr",
    what: "Código QR en PNG.",
    params: [{ name: "text", label: "Texto o enlace", example: "https://yuiapi.vercel.app" }, { name: "size", label: "Tamaño (128-1024)", example: "320" }],
    returns: "image",
  },
  {
    id: "hash",
    group: "Herramientas",
    method: "GET",
    path: "/api/v1/tools/hash",
    what: "Hash de un texto.",
    params: [{ name: "text", label: "Texto", example: "hola" }, { name: "algo", label: "Algoritmo", example: "sha256", options: ["md5", "sha1", "sha256", "sha512"] }],
    returns: "json",
  },
  {
    id: "uuid",
    group: "Herramientas",
    method: "GET",
    path: "/api/v1/tools/uuid",
    what: "UUID v4.",
    params: [{ name: "count", label: "Cantidad (1-50)", example: "3" }],
    returns: "json",
  },
  {
    id: "base64",
    group: "Herramientas",
    method: "GET",
    path: "/api/v1/tools/base64",
    what: "Codifica o decodifica Base64.",
    params: [{ name: "text", label: "Texto", example: "YuiApi" }, { name: "mode", label: "Modo", example: "encode", options: ["encode", "decode"] }],
    returns: "json",
  },
  {
    id: "password",
    group: "Herramientas",
    method: "GET",
    path: "/api/v1/tools/password",
    what: "Contraseña aleatoria segura.",
    params: [{ name: "length", label: "Largo (8-64)", example: "20" }, { name: "symbols", label: "Símbolos", example: "true", options: ["true", "false"] }],
    returns: "json",
  },
  {
    id: "me",
    group: "Cuenta",
    method: "GET",
    path: "/api/v1/me",
    what: "Tu plan y las solicitudes que te quedan hoy.",
    params: [],
    returns: "json",
  },
];

export const GROUPS = ["Stickers", "Búsqueda", "Herramientas", "Cuenta"] as const;

/** Arma la URL relativa con los parámetros no vacíos. */
export function buildUrl(e: Endpoint, values: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const p of e.params) {
    const v = (values[p.name] ?? "").trim();
    if (v) sp.set(p.name, v);
  }
  const qs = sp.toString();
  return qs ? `${e.path}?${qs}` : e.path;
}

/** Ejemplo de curl (la clave siempre va como marcador, nunca la real). */
export function curlFor(e: Endpoint, values: Record<string, string>, base: string): string {
  const url = `${base}${buildUrl(e, values)}`;
  if (e.body === "file") return `curl -X POST -H "x-api-key: TU_CLAVE" --data-binary @foto.jpg "${url}" -o sticker.webp`;
  return `curl -H "x-api-key: TU_CLAVE" "${url}"${e.returns === "image" ? " -o resultado.png" : ""}`;
}
