/** Catálogo único de endpoints v1: documentación y explorador interactivo. */
export type Param = { name: string; label: string; example: string; options?: string[] };
export type Endpoint = {
  id: string;
  group: "Stickers" | "Búsqueda" | "Descargas y archivos" | "Imágenes" | "Generadores" | "Desarrolladores" | "Cuenta";
  method: "GET" | "POST";
  path: string;
  what: string;
  params: Param[];
  body?: "file";
  returns: "json" | "image" | "file";
};

const q = (example: string): Param => ({ name: "q", label: "Búsqueda", example });
const limit: Param = { name: "limit", label: "Límite", example: "5" };
const text: Param = { name: "text", label: "Texto", example: "YuiAPI" };
const upload = (id: string, group: Endpoint["group"], tool: string, what: string): Endpoint => ({
  id, group, method: "POST", path: "/api/v1/tools/" + tool, what, params: [], body: "file", returns: "json",
});

export const ENDPOINTS: Endpoint[] = [
  { id: "sticker-convert", group: "Stickers", method: "POST", path: "/api/v1/sticker", what: "Convierte una imagen o GIF en un sticker de WhatsApp WebP 512×512.", params: [{ name: "fit", label: "Ajuste", example: "contain", options: ["contain", "cover"] }, { name: "quality", label: "Calidad (10-100)", example: "80" }], body: "file", returns: "image" },
  { id: "sticker-search", group: "Stickers", method: "GET", path: "/api/v1/sticker/search", what: "Busca stickers en GIPHY y devuelve enlaces GIF/WebP; el explorador muestra sus vistas previas. Requiere GIPHY_API_KEY y atribución Powered by GIPHY.", params: [q("gato"), limit], returns: "json" },
  { id: "music", group: "Búsqueda", method: "GET", path: "/api/v1/search/music", what: "Canciones de Apple iTunes con fragmento oficial de 30 segundos.", params: [q("Daft Punk"), limit], returns: "json" },
  { id: "anime", group: "Búsqueda", method: "GET", path: "/api/v1/search/anime", what: "Busca anime en Jikan / MyAnimeList.", params: [q("Naruto"), limit], returns: "json" },
  { id: "wiki", group: "Búsqueda", method: "GET", path: "/api/v1/search/wiki", what: "Artículos de Wikipedia con resumen.", params: [q("Machu Picchu"), { name: "lang", label: "Idioma", example: "es" }, limit], returns: "json" },
  { id: "books", group: "Búsqueda", method: "GET", path: "/api/v1/search/books", what: "Busca libros en Open Library.", params: [q("Cien años de soledad"), limit], returns: "json" },
  { id: "images", group: "Búsqueda", method: "GET", path: "/api/v1/search/images", what: "Busca imágenes con licencia abierta en Openverse; devuelve autor y licencia.", params: [q("sakura"), limit], returns: "json" },
  { id: "shows", group: "Búsqueda", method: "GET", path: "/api/v1/search/shows", what: "Busca series y programas en TVmaze; API pública gratuita, con atribución CC BY-SA.", params: [q("Breaking Bad"), limit], returns: "json" },
  { id: "characters", group: "Búsqueda", method: "GET", path: "/api/v1/search/characters", what: "Busca personajes de Rick and Morty; API pública sin clave.", params: [q("Rick"), limit], returns: "json" },
  { id: "countries", group: "Búsqueda", method: "GET", path: "/api/v1/search/countries", what: "Busca países y devuelve capital, región, población, bandera, idiomas y monedas.", params: [q("Peru"), limit], returns: "json" },
  { id: "papers", group: "Búsqueda", method: "GET", path: "/api/v1/search/papers", what: "Busca artículos y publicaciones científicas en Crossref; sin registro ni API key.", params: [q("machine learning"), limit], returns: "json" },
  { id: "ebooks", group: "Búsqueda", method: "GET", path: "/api/v1/search/ebooks", what: "Busca libros electrónicos de dominio público en Gutendex / Project Gutenberg.", params: [q("Sherlock Holmes"), limit], returns: "json" },

  upload("file-info", "Descargas y archivos", "file-info", "Analiza un archivo local: nombre, tamaño, MIME y metadatos básicos de imagen."),
  upload("file-base64", "Descargas y archivos", "file-base64", "Convierte un archivo adjunto a Base64 y devuelve sus metadatos."),
  { id: "youtube-audio", group: "Descargas y archivos", method: "GET", path: "/api/v1/download/ytaudio", what: "Prepara el audio MP3 de un enlace público de YouTube y lo entrega como archivo descargable.", params: [{ name: "url", label: "URL de YouTube", example: "https://www.youtube.com/watch?v=VIDEO_ID" }], returns: "file" },
  { id: "youtube-video", group: "Descargas y archivos", method: "GET", path: "/api/v1/download/ytvideo", what: "Prepara un video de YouTube y lo entrega como archivo descargable. La calidad depende de la disponibilidad del proveedor.", params: [{ name: "url", label: "URL de YouTube", example: "https://youtu.be/VIDEO_ID" }, { name: "quality", label: "Calidad", example: "720", options: ["360", "480", "720", "1080"] }], returns: "file" },
  { id: "pinterest-download", group: "Descargas y archivos", method: "GET", path: "/api/v1/download/pinterest", what: "Intenta obtener la imagen o el video público de un Pin cuando Pinterest expone un enlace multimedia directo.", params: [{ name: "url", label: "URL de Pinterest", example: "https://www.pinterest.com/pin/..." }], returns: "file" },
  { id: "qr", group: "Generadores", method: "GET", path: "/api/v1/tools/qr", what: "Genera un QR PNG descargable y visible en el explorador.", params: [{ name: "text", label: "Texto o enlace", example: "https://yuiapi.vercel.app" }, { name: "size", label: "Tamaño (128-1024)", example: "320" }], returns: "image" },
  { id: "hash", group: "Generadores", method: "GET", path: "/api/v1/tools/hash", what: "Calcula el hash de un texto.", params: [text, { name: "algo", label: "Algoritmo", example: "sha256", options: ["md5", "sha1", "sha256", "sha512"] }], returns: "json" },
  { id: "uuid", group: "Generadores", method: "GET", path: "/api/v1/tools/uuid", what: "Genera UUID v4 aleatorios.", params: [{ name: "count", label: "Cantidad (1-50)", example: "3" }], returns: "json" },
  { id: "password", group: "Generadores", method: "GET", path: "/api/v1/tools/password", what: "Genera una contraseña aleatoria criptográficamente segura.", params: [{ name: "length", label: "Largo (8-64)", example: "20" }, { name: "symbols", label: "Símbolos", example: "true", options: ["true", "false"] }], returns: "json" },

  { id: "image-resize", group: "Imágenes", method: "POST", path: "/api/v1/tools/image-resize", what: "Redimensiona una imagen y entrega vista previa y archivo descargable.", params: [{ name: "width", label: "Ancho (1-2048)", example: "512" }, { name: "height", label: "Alto (1-2048)", example: "512" }, { name: "fit", label: "Ajuste", example: "inside", options: ["inside", "cover"] }], body: "file", returns: "image" },
  { id: "image-compress", group: "Imágenes", method: "POST", path: "/api/v1/tools/image-compress", what: "Comprime una imagen a WebP ajustando la calidad.", params: [{ name: "quality", label: "Calidad (20-95)", example: "75" }], body: "file", returns: "image" },
  { id: "image-convert", group: "Imágenes", method: "POST", path: "/api/v1/tools/image-convert", what: "Convierte una imagen a PNG, JPG o WebP.", params: [{ name: "format", label: "Formato de salida", example: "webp", options: ["png", "jpeg", "webp"] }], body: "file", returns: "image" },
  { id: "image-blur", group: "Imágenes", method: "POST", path: "/api/v1/tools/image-blur", what: "Aplica desenfoque a una imagen.", params: [{ name: "sigma", label: "Intensidad (1-20)", example: "5" }], body: "file", returns: "image" },

  { id: "json-format", group: "Desarrolladores", method: "GET", path: "/api/v1/tools/json-format", what: "Valida y formatea JSON con indentación de dos espacios.", params: [{ name: "text", label: "JSON", example: "{\"name\":\"YuiAPI\",\"ok\":true}" }], returns: "json" },
  { id: "json-validate", group: "Desarrolladores", method: "GET", path: "/api/v1/tools/json-validate", what: "Comprueba si una cadena es JSON válido.", params: [{ name: "text", label: "JSON", example: "{\"ok\":true}" }], returns: "json" },
  { id: "url-encode", group: "Desarrolladores", method: "GET", path: "/api/v1/tools/url-encode", what: "Codifica texto para utilizarlo en una URL.", params: [text], returns: "json" },
  { id: "url-decode", group: "Desarrolladores", method: "GET", path: "/api/v1/tools/url-decode", what: "Decodifica texto escapado para URL.", params: [{ name: "text", label: "Texto codificado", example: "Hola%20YuiAPI" }], returns: "json" },
  { id: "base64", group: "Desarrolladores", method: "GET", path: "/api/v1/tools/base64", what: "Codifica o decodifica texto Base64.", params: [text, { name: "mode", label: "Modo", example: "encode", options: ["encode", "decode"] }], returns: "json" },
  { id: "me", group: "Cuenta", method: "GET", path: "/api/v1/me", what: "Consulta tu plan y las solicitudes que te quedan hoy.", params: [], returns: "json" },
];

export const GROUPS = ["Stickers", "Búsqueda", "Descargas y archivos", "Imágenes", "Generadores", "Desarrolladores", "Cuenta"] as const;

export function buildUrl(e: Endpoint, values: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const p of e.params) {
    const v = (values[p.name] ?? "").trim();
    if (v) sp.set(p.name, v);
  }
  const qs = sp.toString();
  return qs ? e.path + "?" + qs : e.path;
}

export function curlFor(e: Endpoint, values: Record<string, string>, base: string): string {
  const url = base + buildUrl(e, values);
  if (e.body === "file") return "curl -X POST -H \"x-api-key: TU_CLAVE\" -H \"content-type: application/octet-stream\" --data-binary @archivo \"" + url + "\" -o resultado";
  return "curl -H \"x-api-key: TU_CLAVE\" \"" + url + "\"" + (e.returns !== "json" ? " -o resultado" : "");
}

export function jsFor(e: Endpoint, values: Record<string, string>, base: string): string {
  const url = base + buildUrl(e, values);
  if (e.body === "file") return "const file = document.querySelector(\"input[type=file]\").files[0];\nconst response = await fetch(\"" + url + "\", {\n  method: \"POST\",\n  headers: { \"x-api-key\": \"TU_CLAVE\", \"content-type\": file.type, \"x-file-name\": file.name },\n  body: file\n});\nif (!response.ok) throw new Error(await response.text());\nconst blob = await response.blob();\nconst download = URL.createObjectURL(blob);\nwindow.open(download);";
  return "const response = await fetch(\"" + url + "\", { headers: { \"x-api-key\": \"TU_CLAVE\" } });\nif (!response.ok) throw new Error(await response.text());\n" + (e.returns === "json" ? "const data = await response.json();\nconsole.log(data);" : "const blob = await response.blob();\nconst download = URL.createObjectURL(blob);\nwindow.open(download);");
}

export function pythonFor(e: Endpoint, values: Record<string, string>, base: string): string {
  const url = base + buildUrl(e, values);
  if (e.body === "file") return "import requests\n\nwith open(\"archivo\", \"rb\") as f:\n    response = requests.post(\"" + url + "\", headers={\"x-api-key\": \"TU_CLAVE\", \"x-file-name\": \"archivo\"}, data=f)\nresponse.raise_for_status()\nwith open(\"resultado\", \"wb\") as out:\n    out.write(response.content)";
  return "import requests\n\nresponse = requests.get(\"" + url + "\", headers={\"x-api-key\": \"TU_CLAVE\"})\nresponse.raise_for_status()\n" + (e.returns === "json" ? "print(response.json())" : "with open(\"resultado\", \"wb\") as f:\n    f.write(response.content)");
}
