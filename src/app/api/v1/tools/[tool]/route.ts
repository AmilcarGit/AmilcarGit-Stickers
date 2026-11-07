import QRCode from "qrcode";
import sharp from "sharp";
import { AppError } from "@/server/errors";
import { base64, hashText, password, textParam, uuids } from "@/server/tools";
import { preflight, v1With } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 20;
export const OPTIONS = preflight;

const MAX_UPLOAD = 4 * 1024 * 1024;
const TOOLS = [
  "qr", "hash", "uuid", "base64", "password",
  "json-format", "json-validate", "url-encode", "url-decode",
  "file-info", "file-base64", "image-resize", "image-compress", "image-convert", "image-blur",
] as const;

function boundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

async function readUpload(req: Request, maxBytes = MAX_UPLOAD): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new AppError(413, "El archivo supera el máximo permitido.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) throw new AppError(400, "Adjunta un archivo en el cuerpo de la solicitud.");
  if (bytes.length > maxBytes) throw new AppError(413, "El archivo supera el máximo permitido.");
  return bytes;
}

function download(bytes: Uint8Array, type: string, filename: string): Response {
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "content-type": type,
      "content-disposition": \`attachment; filename="\${filename}"\`,
      "x-file-name": filename,
    },
  });
}

function imageInput(bytes: Uint8Array) {
  return sharp(bytes, { limitInputPixels: 25_000_000, animated: false });
}

export const GET = v1With<{ tool: string }>(async ({ url }, { tool }) => {
  const sp = url.searchParams;
  switch (tool) {
    case "qr": {
      const text = textParam(sp.get("text"));
      const size = boundedInt(sp.get("size"), 400, 128, 1024);
      const png = await QRCode.toBuffer(text, { width: size, margin: 2, type: "png" });
      return download(new Uint8Array(png), "image/png", "yuiapi-qr.png");
    }
    case "hash": return hashText(textParam(sp.get("text")), sp.get("algo") ?? "sha256");
    case "uuid": return { uuids: uuids(boundedInt(sp.get("count"), 1, 1, 50)) };
    case "base64": return { result: base64(textParam(sp.get("text")), sp.get("mode") ?? "encode") };
    case "password": return { password: password(boundedInt(sp.get("length"), 16, 8, 64), sp.get("symbols") !== "false") };
    case "json-format":
    case "json-validate": {
      const raw = textParam(sp.get("text"), "text");
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new AppError(400, "JSON no válido. Revisa comas, comillas y llaves."); }
      return tool === "json-format" ? { valid: true, formatted: JSON.stringify(parsed, null, 2) } : { valid: true, message: "JSON válido." };
    }
    case "url-encode": return { result: encodeURIComponent(textParam(sp.get("text"))) };
    case "url-decode": {
      try { return { result: decodeURIComponent(textParam(sp.get("text"))) }; }
      catch { throw new AppError(400, "La cadena no contiene una URL codificada válida."); }
    }
    default: throw new AppError(404, \`Herramienta desconocida. Usa: \${TOOLS.join(", ")}.\`);
  }
});

export const POST = v1With<{ tool: string }>(async ({ req, url }, { tool }) => {
  if (!(TOOLS as readonly string[]).includes(tool)) throw new AppError(404, \`Herramienta desconocida. Usa: \${TOOLS.join(", ")}.\`);
  const bytes = await readUpload(req, tool === "file-base64" ? 2 * 1024 * 1024 : MAX_UPLOAD);
  const contentType = req.headers.get("content-type") ?? "application/octet-stream";
  const requestedName = req.headers.get("x-file-name") ?? "archivo";
  const safeName = requestedName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "archivo";

  if (tool === "file-info") {
    let metadata: sharp.Metadata | null = null;
    try { metadata = await imageInput(bytes).metadata(); } catch { /* Archivo no gráfico: solo metadatos básicos. */ }
    return {
      name: safeName, bytes: bytes.length, sizeKB: Number((bytes.length / 1024).toFixed(2)), contentType,
      image: metadata ? { format: metadata.format ?? null, width: metadata.width ?? null, height: metadata.height ?? null, animated: (metadata.pages ?? 1) > 1 } : null,
    };
  }
  if (tool === "file-base64") return { name: safeName, contentType, bytes: bytes.length, base64: Buffer.from(bytes).toString("base64") };
  if (!["image-resize", "image-compress", "image-convert", "image-blur"].includes(tool)) throw new AppError(405, "Esta herramienta no admite archivos por POST.");

  let pipeline = imageInput(bytes);
  let metadata: sharp.Metadata;
  try { metadata = await pipeline.metadata(); } catch { throw new AppError(400, "No se pudo leer la imagen. Usa PNG, JPG o WebP."); }
  if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format)) throw new AppError(400, "Formato de imagen no compatible. Usa PNG, JPG o WebP.");
  if ((metadata.pages ?? 1) > 1) throw new AppError(400, "Esta operación procesa imágenes estáticas; convierte el GIF en sticker con /api/v1/sticker.");

  const sp = url.searchParams;
  let format: "png" | "jpeg" | "webp" = "webp";
  const filename = safeName.replace(/\.[^.]+$/, "");
  if (tool === "image-resize") {
    const width = boundedInt(sp.get("width"), 512, 1, 2048);
    const height = boundedInt(sp.get("height"), 512, 1, 2048);
    pipeline = pipeline.resize(width, height, { fit: sp.get("fit") === "cover" ? "cover" : "inside", withoutEnlargement: true });
  } else if (tool === "image-compress") {
    pipeline = pipeline.webp({ quality: boundedInt(sp.get("quality"), 75, 20, 95), effort: 4 });
  } else if (tool === "image-convert") {
    const requested = sp.get("format");
    if (requested !== "png" && requested !== "jpeg" && requested !== "webp") throw new AppError(400, "El formato debe ser png, jpeg o webp.");
    format = requested;
    pipeline = format === "png" ? pipeline.png({ compressionLevel: 9 }) : format === "jpeg" ? pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 85 }) : pipeline.webp({ quality: 85 });
  } else if (tool === "image-blur") {
    pipeline = pipeline.blur(boundedInt(sp.get("sigma"), 5, 1, 20));
  }

  if (tool !== "image-compress" && tool !== "image-convert") {
    const original = metadata.format === "jpeg" ? "jpeg" : metadata.format;
    format = original === "png" || original === "jpeg" || original === "webp" ? original : "webp";
    pipeline = format === "png" ? pipeline.png() : format === "jpeg" ? pipeline.jpeg({ quality: 85 }) : pipeline.webp({ quality: 85 });
  }
  let output: Buffer;
  try { output = await pipeline.toBuffer(); } catch { throw new AppError(400, "No se pudo procesar la imagen."); }
  const extension = format === "jpeg" ? "jpg" : format;
  return download(new Uint8Array(output), \`image/\${format === "jpeg" ? "jpeg" : format}\`, \`\${filename}-yuiapi.\${extension}\`);
});
