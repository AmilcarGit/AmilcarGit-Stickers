import { rateLimit } from "@/lib/rate-limit";
import { json } from "@/lib/server-auth";
import { buildPackZip } from "@/lib/pack-zip";
import { bodyOf } from "@/lib/bytes";
import { WA } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  title?: unknown;
  publisher?: unknown;
  animated?: unknown;
  credits?: unknown;
  trayUrl?: unknown;
  stickers?: unknown;
};

/** Solo se descargan archivos del almacenamiento de la propia plataforma (evita SSRF). */
function isBlobUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

async function fetchBytes(url: string, maxBytes: number): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error("archivo no disponible");
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("archivo demasiado grande");
  return buf;
}

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!rateLimit(`zip:${ip}`, 30, 10 * 60 * 1000)) return json({ error: "Demasiadas descargas seguidas." }, 429);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }

  const list = Array.isArray(body.stickers) ? body.stickers : [];
  if (list.length < 1 || list.length > WA.maxStickers) return json({ error: "Paquete inválido." }, 400);
  if (!isBlobUrl(body.trayUrl) || !list.every((s) => s && typeof s === "object" && isBlobUrl((s as { url?: unknown }).url))) {
    return json({ error: "Dirección de archivo no permitida." }, 400);
  }

  try {
    const animated = body.animated === true;
    const [tray, stickers] = await Promise.all([
      fetchBytes(body.trayUrl as string, WA.trayMaxBytes),
      Promise.all(
        list.map(async (s) => {
          const item = s as { url: string; emojis?: unknown };
          const emojis = Array.isArray(item.emojis) ? item.emojis.filter((e): e is string => typeof e === "string").slice(0, WA.maxEmojis) : [];
          return { bytes: await fetchBytes(item.url, WA.animatedMaxBytes), emojis };
        }),
      ),
    ]);
    const title = typeof body.title === "string" ? body.title.slice(0, 60) : "Paquete";
    const publisher = typeof body.publisher === "string" ? body.publisher.slice(0, 60) : "";
    const credits = typeof body.credits === "string" ? body.credits.slice(0, 4000) : "";
    const zip = await buildPackZip({ title, publisher, stickers, tray, credits, animated });
    return new Response(bodyOf(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="paquete-stickers.zip"',
        "cache-control": "no-store",
      },
    });
  } catch {
    return json({ error: "No se pudo armar el paquete. Inténtalo otra vez." }, 502);
  }
}
