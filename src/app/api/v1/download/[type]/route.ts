import crypto from "node:crypto";
import { AppError } from "@/server/errors";
import { preflight, v1With } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 60;
export const OPTIONS = preflight;

const SAVE_TUBE_KEY = process.env.SAVETUBE_KEY || "C5D58EF67A7584E4A29F6C35BBC4EB12";
const MAX_DOWNLOAD = 100 * 1024 * 1024;
const REQUEST_TIMEOUT = 18_000;

function youtubeId(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0]?.match(/^[\w-]{11}$/)?.[0] ?? null;
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(url.hostname)) return null;
    const id = url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function safeFilename(value: string, fallback: string): string {
  const clean = value.normalize("NFKD").replace(/[^\w .()-]/g, "").trim().replace(/[ .]+/g, "_").slice(0, 90);
  return (clean || fallback).replace(/\.(mp3|mp4|webm|m4a)$/i, "");
}

async function timedFetch(input: string | URL, init: RequestInit = {}, timeout = REQUEST_TIMEOUT): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeout) });
}

function decryptSaveTube(encoded: string): { title?: string; duration?: number; thumbnail?: string; key: string } {
  const encrypted = Buffer.from(encoded, "base64");
  if (encrypted.length < 32 || encrypted.length % 16 !== 0) throw new AppError(502, "El proveedor devolvió datos de descarga inválidos.");
  const iv = encrypted.subarray(0, 16);
  const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(SAVE_TUBE_KEY, "hex"), iv);
  const plain = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
  const parsed = JSON.parse(plain.toString("utf8"));
  if (!parsed || typeof parsed.key !== "string") throw new AppError(502, "No se pudo interpretar la respuesta del proveedor.");
  return parsed;
}

let cdnCache: { host: string; expires: number } | null = null;

async function getSaveTubeCdn(force = false): Promise<string> {
  if (!force && cdnCache && cdnCache.expires > Date.now()) return cdnCache.host;
  const response = await timedFetch("https://media.savetube.vip/api/random-cdn");
  if (!response.ok) throw new AppError(502, "El servicio de descargas de YouTube no está disponible.");
  const data = await response.json() as { cdn?: string };
  if (!data.cdn || !/^[a-z0-9.-]+$/i.test(data.cdn) || !data.cdn.endsWith("savetube.vip")) {
    throw new AppError(502, "El proveedor devolvió un servidor de descarga no válido.");
  }
  cdnCache = { host: data.cdn, expires: Date.now() + 5 * 60_000 };
  return data.cdn;
}

async function createYoutubeDownload(id: string, kind: "audio" | "video", quality: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const cdn = await getSaveTubeCdn(attempt > 0);
      const infoResponse = await timedFetch(`https://${cdn}/v2/info`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://yt.savetube.me",
          referer: "https://yt.savetube.me/",
          "user-agent": "Mozilla/5.0 (compatible; YuiAPI/1.0)"
        },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${id}` })
      });
      if (!infoResponse.ok) throw new Error("No se pudo obtener la información del video.");
      const infoPayload = await infoResponse.json() as { data?: string };
      if (!infoPayload.data) throw new Error("El proveedor no devolvió información del video.");
      const info = decryptSaveTube(infoPayload.data);
      const downloadResponse = await timedFetch(`https://${cdn}/download`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://yt.savetube.me",
          referer: "https://yt.savetube.me/",
          "user-agent": "Mozilla/5.0 (compatible; YuiAPI/1.0)"
        },
        body: JSON.stringify({
          id,
          downloadType: kind,
          quality: kind === "audio" ? "128" : quality,
          key: info.key
        })
      });
      if (!downloadResponse.ok) throw new Error("El proveedor no pudo preparar el archivo.");
      const payload = await downloadResponse.json() as { data?: { downloadUrl?: string } };
      const downloadUrl = payload.data?.downloadUrl;
      if (!downloadUrl) throw new Error("El proveedor no devolvió un enlace de descarga.");
      const parsedUrl = new URL(downloadUrl);
      if (parsedUrl.protocol !== "https:") throw new Error("El enlace de descarga no es seguro.");
      return { downloadUrl, title: info.title || `youtube-${id}`, duration: info.duration ?? null, thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    } catch (error) {
      lastError = error;
      cdnCache = null;
    }
  }
  console.error("YouTube provider error:", lastError instanceof Error ? lastError.message : "unknown");
  throw new AppError(502, "No se pudo preparar la descarga de YouTube. Inténtalo más tarde.");
}

function pinterestMediaUrl(html: string): { url: string; type: "image" | "video" } | null {
  const candidates = [
    { key: "og:video", type: "video" as const },
    { key: "og:video:url", type: "video" as const },
    { key: "twitter:player:stream", type: "video" as const },
    { key: "og:image", type: "image" as const },
    { key: "twitter:image", type: "image" as const }
  ];
  for (const item of candidates) {
    const escaped = item.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"));
    const raw = match?.[1] || match?.[2];
    if (!raw) continue;
    try {
      const url = new URL(raw.replace(/&amp;/g, "&"));
      if (url.protocol === "https:" && (url.hostname === "pinimg.com" || url.hostname.endsWith(".pinimg.com"))) return { url: url.toString(), type: item.type };
    } catch {
      continue;
    }
  }
  return null;
}

function attachment(response: Response, filename: string, contentType: string): Response {
  if (!response.body) throw new AppError(502, "El proveedor devolvió un archivo vacío.");
  const length = Number(response.headers.get("content-length") || "0");
  if (length > MAX_DOWNLOAD) throw new AppError(413, "El archivo supera el límite de 100 MB.");
  const headers = new Headers({
    "content-type": contentType,
    "content-disposition": `attachment; filename="${filename}"`,
    "x-file-name": filename,
    "cache-control": "no-store"
  });
  if (length > 0) headers.set("content-length", String(length));
  return new Response(response.body, { status: 200, headers });
}

async function streamMedia(url: string, name: string, expected: "audio" | "video" | "pinterest"): Promise<Response> {
  const response = await timedFetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; YuiAPI/1.0)" } }, 55_000);
  if (!response.ok) throw new AppError(502, "El servidor de archivos no pudo entregar la descarga.");
  const type = (response.headers.get("content-type") || "application/octet-stream").split(";")[0].toLowerCase();
  const allowed = expected === "audio" ? type.startsWith("audio/") || type === "application/octet-stream"
    : expected === "video" ? type.startsWith("video/") || type === "application/octet-stream"
    : type.startsWith("image/") || type.startsWith("video/");
  if (!allowed) throw new AppError(502, "El proveedor devolvió un formato de archivo no compatible.");
  const ext = type.includes("mpeg") ? "mp3" : type.includes("mp4") ? "mp4" : type.includes("webp") ? "webp" : type.includes("png") ? "png" : type.includes("jpeg") ? "jpg" : type.includes("gif") ? "gif" : expected === "audio" ? "mp3" : "mp4";
  return attachment(response, `${name}.${ext}`, type);
}

export const GET = v1With<{ type: string }>(async ({ url }, { type }) => {
  const raw = (url.searchParams.get("url") || "").trim();
  if (!raw || raw.length > 2048) throw new AppError(400, "El parámetro 'url' es obligatorio y debe ser válido.");

  if (type === "ytaudio" || type === "ytvideo") {
    const id = youtubeId(raw);
    if (!id) throw new AppError(400, "URL de YouTube no válida. Usa un enlace youtube.com o youtu.be.");
    const quality = url.searchParams.get("quality") || "720";
    if (type === "ytvideo" && !["360", "480", "720", "1080"].includes(quality)) throw new AppError(400, "La calidad debe ser 360, 480, 720 o 1080.");
    const kind = type === "ytaudio" ? "audio" : "video";
    const data = await createYoutubeDownload(id, kind, quality);
    return streamMedia(data.downloadUrl, safeFilename(data.title, `youtube-${id}`), kind);
  }

  if (type === "pinterest") {
    let pageUrl: URL;
    try { pageUrl = new URL(raw); } catch { throw new AppError(400, "URL de Pinterest no válida."); }
    if (!["pinterest.com", "www.pinterest.com", "pin.it", "www.pin.it", "es.pinterest.com", "id.pinterest.com"].includes(pageUrl.hostname)) {
      throw new AppError(400, "Solo se aceptan enlaces de Pinterest.");
    }
    const page = await timedFetch(pageUrl.toString(), { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; YuiAPI/1.0)" } });
    if (!page.ok || !["pinterest.com", "www.pinterest.com", "es.pinterest.com", "id.pinterest.com"].includes(new URL(page.url).hostname)) throw new AppError(502, "No se pudo abrir el Pin público.");
    const html = await page.text();
    const media = pinterestMediaUrl(html);
    if (!media) throw new AppError(422, "Pinterest no expuso un enlace directo de imagen o video para este Pin.");
    return streamMedia(media.url, "pinterest-download", "pinterest");
  }

  throw new AppError(404, "Descarga no disponible. Usa ytaudio, ytvideo o pinterest.");
});
