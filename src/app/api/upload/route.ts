import { put } from "@vercel/blob";
import sharp from "sharp";
import { isJpegBytes, isPngBytes, isWebpBytes } from "@/lib/bytes";
import { rateLimit } from "@/lib/rate-limit";
import { json, verifyRequest } from "@/lib/server-auth";
import { WA } from "@/lib/whatsapp";

export const runtime = "nodejs";

type Kind = "sticker" | "tray" | "avatar";

export async function POST(req: Request): Promise<Response> {
  const user = await verifyRequest(req);
  if (!user) return json({ error: "Inicia sesión para subir archivos." }, 401);
  if (!user.emailVerified) return json({ error: "Verifica tu correo electrónico antes de publicar." }, 403);
  if (!rateLimit(`upload:${user.uid}`, 150, 60 * 60 * 1000)) {
    return json({ error: "Demasiadas subidas seguidas. Espera un rato." }, 429);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({ error: "El almacenamiento de archivos no está configurado en el servidor." }, 503);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }
  const file = form.get("file");
  const kind = form.get("kind") as Kind | null;
  if (!(file instanceof File) || (kind !== "sticker" && kind !== "tray" && kind !== "avatar")) {
    return json({ error: "Falta el archivo o el tipo." }, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let meta: sharp.Metadata;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    return json({ error: "El archivo no es una imagen válida." }, 400);
  }
  const width = meta.width ?? 0;
  const height = meta.pageHeight ?? meta.height ?? 0;
  const animated = (meta.pages ?? 1) > 1;

  let ext: string;
  let contentType: string;

  if (kind === "sticker") {
    if (!isWebpBytes(bytes)) return json({ error: "El sticker debe ser WebP." }, 400);
    const max = animated ? WA.animatedMaxBytes : WA.staticMaxBytes;
    if (bytes.length > max) return json({ error: `El sticker pesa más de ${Math.round(max / 1024)} KB.` }, 400);
    if (width !== WA.size || height !== WA.size) return json({ error: "El sticker debe medir 512x512 px." }, 400);
    ext = "webp";
    contentType = "image/webp";
  } else if (kind === "tray") {
    if (!isPngBytes(bytes) && !isWebpBytes(bytes)) return json({ error: "El ícono debe ser PNG o WebP." }, 400);
    if (bytes.length > WA.trayMaxBytes) return json({ error: "El ícono pesa más de 50 KB." }, 400);
    if (width !== WA.traySize || height !== WA.traySize) return json({ error: "El ícono debe medir 96x96 px." }, 400);
    ext = isPngBytes(bytes) ? "png" : "webp";
    contentType = ext === "png" ? "image/png" : "image/webp";
  } else {
    const okType = isPngBytes(bytes) || isJpegBytes(bytes) || isWebpBytes(bytes);
    if (!okType) return json({ error: "La foto debe ser PNG, JPG o WebP." }, 400);
    if (bytes.length > 300 * 1024) return json({ error: "La foto pesa más de 300 KB." }, 400);
    if (width > 1024 || height > 1024) return json({ error: "La foto es demasiado grande." }, 400);
    ext = isPngBytes(bytes) ? "png" : isJpegBytes(bytes) ? "jpg" : "webp";
    contentType = ext === "png" ? "image/png" : ext === "jpg" ? "image/jpeg" : "image/webp";
  }

  const path = `${kind}s/${user.uid}/${crypto.randomUUID()}.${ext}`;
  const blob = await put(path, file, { access: "public", contentType, addRandomSuffix: false });
  return json({ url: blob.url, bytes: bytes.length, animated });
}
