import sharp from "sharp";
import { isPngBytes } from "@/lib/bytes";
import { rateLimit } from "@/lib/rate-limit";
import { json, verifyRequest } from "@/lib/server-auth";

export const runtime = "nodejs";

const MAX_PNG_BYTES = 3 * 1024 * 1024;

/**
 * Convierte un PNG de 512x512 a WebP con transparencia. Solo lo usan los navegadores que
 * no pueden codificar WebP en canvas (Safari en iPhone/iPad).
 */
export async function POST(req: Request): Promise<Response> {
  const user = await verifyRequest(req);
  if (!user) return json({ error: "Inicia sesión para usar el convertidor." }, 401);
  if (!rateLimit(`webp:${user.uid}`, 900, 60 * 60 * 1000)) {
    return json({ error: "Demasiadas conversiones seguidas. Espera un rato." }, 429);
  }

  const input = new Uint8Array(await req.arrayBuffer());
  if (input.length === 0 || input.length > MAX_PNG_BYTES || !isPngBytes(input)) {
    return json({ error: "Se esperaba un PNG de hasta 3 MB." }, 400);
  }

  const q = Number(new URL(req.url).searchParams.get("q") ?? "75");
  const quality = Math.min(100, Math.max(10, Number.isFinite(q) ? q : 75));

  try {
    const out = await sharp(input)
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality, alphaQuality: 100, effort: 4 })
      .toBuffer();
    return new Response(new Uint8Array(out), {
      headers: { "content-type": "image/webp", "cache-control": "no-store" },
    });
  } catch {
    return json({ error: "No se pudo convertir la imagen." }, 400);
  }
}
