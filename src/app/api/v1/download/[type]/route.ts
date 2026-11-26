import crypto from "node:crypto";
import { AppError } from "@/server/errors";
import { preflight, v1With } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 120;
export const OPTIONS = preflight;

const SAVE_TUBE_KEY = process.env.SAVETUBE_KEY || "C5D58EF67A7584E4A29F6C35BBC4EB12";
const MAX_DOWNLOAD = 800 * 1024 * 1024;
const REQUEST_TIMEOUT = 30_000;
const STREAM_TIMEOUT = 110_000;

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
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 700 * attempt));
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
      // Si la calidad pedida no está disponible, se prueba con las más bajas (360 casi siempre existe).
      const qualities = kind === "audio" ? ["128"] : QUALITIES.filter((q) => Number(q) <= Number(quality));
      let downloadUrl: string | undefined;
      for (const q of qualities.length ? qualities : ["360"]) {
        const downloadResponse = await timedFetch(`https://${cdn}/download`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://yt.savetube.me",
            referer: "https://yt.savetube.me/",
            "user-agent": "Mozilla/5.0 (compatible; YuiAPI/1.0)"
          },
          body: JSON.stringify({ id, downloadType: kind, quality: q, key: info.key })
        }).catch(() => null);
        if (!downloadResponse?.ok) continue;
        const payload = await downloadResponse.json().catch(() => ({})) as { data?: { downloadUrl?: string } };
        downloadUrl = payload.data?.downloadUrl;
        if (downloadUrl) break;
      }
      if (!downloadUrl) throw new Error("El proveedor no pudo preparar el archivo.");
      const parsedUrl = new URL(downloadUrl);
      if (parsedUrl.protocol !== "https:") throw new Error("El enlace de descarga no es seguro.");
      return { downloadUrl, title: info.title || `youtube-${id}`, duration: info.duration ?? null, thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    } catch (error) {
      lastError = error;
      cdnCache = null;
    }
  }
  console.error("YouTube provider error:", lastError instanceof Error ? lastError.message : String(lastError ?? "unknown"));
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
  if (length > MAX_DOWNLOAD) throw new AppError(413, "El archivo supera el límite configurado de 800 MB.");
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
  const response = await timedFetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; YuiAPI/1.0)" } }, STREAM_TIMEOUT);
  if (!response.ok) throw new AppError(502, "El servidor de archivos no pudo entregar la descarga.");
  const type = (response.headers.get("content-type") || "application/octet-stream").split(";")[0].toLowerCase();
  const allowed = expected === "audio" ? type.startsWith("audio/") || type === "application/octet-stream"
    : expected === "video" ? type.startsWith("video/") || type === "application/octet-stream"
    : type.startsWith("image/") || type.startsWith("video/");
  if (!allowed) throw new AppError(502, "El proveedor devolvió un formato de archivo no compatible.");
  const ext = type.includes("mpeg") ? "mp3" : type.includes("mp4") ? "mp4" : type.includes("webp") ? "webp" : type.includes("png") ? "png" : type.includes("jpeg") ? "jpg" : type.includes("gif") ? "gif" : expected === "audio" ? "mp3" : "mp4";
  return attachment(response, `${name}.${ext}`, type);
}

/** Descarga con el servicio yt-dlp propio (YTDLP_URL + YTDLP_SHARED_SECRET). Devuelve null si no está configurado o falla. */
async function downloadWithYtdlp(rawUrl: string, quality: string): Promise<Response | null> {
  const base = process.env.YTDLP_URL;
  const secret = process.env.YTDLP_SHARED_SECRET;
  if (!base || !secret) return null;
  try {
    const response = await timedFetch(new URL("/download", base), {
      method: "POST",
      headers: { "content-type": "application/json", "x-ytdlp-token": secret },
      body: JSON.stringify({ url: rawUrl, quality: Number(quality) })
    }, 100_000);
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!type.startsWith("video/") && type !== "application/octet-stream") return null;
    return attachment(response, "youtube.mp4", "video/mp4");
  } catch (error) {
    console.error("yt-dlp service error:", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

export const GET = v1With<{ type: string }>(async ({ url }, { type }) => {
  const raw = (url.searchParams.get("url") || "").trim();
  if (!raw || raw.length > 2048) throw new AppError(400, "El parámetro 'url' es obligatorio y debe ser válido.");

  if (type === "ytaudio" || type === "ytvideo") {
    const id = youtubeId(raw);
    if (!id) throw new AppError(400, "URL de YouTube no válida. Usa un enlace youtube.com o youtu.be.");
    const quality = url.searchParams.get("quality") || "720";
    if (type === "ytvideo" && !["360", "480", "720", "1080"].includes(quality)) throw new AppError(400, "La calidad debe ser 360, 480, 720 o 1080.");
    if (type === "ytvideo") {
      const serviceUrl = process.env.YTDLP_SERVICE_URL;
      const sharedSecret = process.env.YTDLP_SHARED_SECRET;
      if (!serviceUrl || !sharedSecret) throw new AppError(503, "El servicio yt-dlp todavía no está configurado en Vercel.");
      let serviceResponse: Response;
      try {
        serviceResponse = await fetch(new URL("/download", serviceUrl), { method: "POST", headers: { "content-type": "application/json", "x-ytdlp-token": sharedSecret }, body: JSON.stringify({ url: raw, quality: Number(quality) }), cache: "no-store", signal: AbortSignal.timeout(115_000) });
      } catch (error) {
        console.error("yt-dlp service request failed:", error instanceof Error ? error.message : String(error));
        throw new AppError(502, "No se pudo conectar con el servicio yt-dlp. Comprueba que Render esté activo.");
      }
      if (!serviceResponse.ok) {
        const detail = (await serviceResponse.text()).slice(0, 700);
        console.error("yt-dlp service error:", serviceResponse.status, detail);
        throw new AppError(502, "yt-dlp no pudo descargar el video: " + (detail || serviceResponse.statusText));
      }
      if (!serviceResponse.body) throw new AppError(502, "yt-dlp devolvió un archivo vacío.");
      const contentType = (serviceResponse.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("video/mp4") && !contentType.includes("application/octet-stream")) throw new AppError(502, "yt-dlp no devolvió un archivo MP4 válido.");
      const filename = serviceResponse.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1] || "youtube-" + id + ".mp4";
      return attachment(new Response(serviceResponse.body, { headers: { "content-type": "video/mp4", "content-length": serviceResponse.headers.get("content-length") || "" } }), filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100), "video/mp4");
    }
    const data = await createYoutubeDownload(id, "audio", quality);
    return streamMedia(data.downloadUrl, "youtube-" + id, "audio");
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
