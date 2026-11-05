import { buildPackZip, buildWastickers } from "@/lib/pack-zip";
import { LICENSES, buildCredits, creditsToText } from "@/lib/credits";
import type { Pack } from "@/lib/types";
import { WA } from "@/lib/whatsapp";
import { AppError } from "./errors";

/** Solo se descargan archivos del almacenamiento de la plataforma (evita SSRF). */
export function isBlobUrl(raw: unknown): raw is string {
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
  if (!res.ok) throw new AppError(502, "Un archivo del paquete no está disponible.");
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new AppError(502, "Un archivo del paquete es demasiado grande.");
  return buf;
}

export async function buildPackFile(pack: Pack, format: "zip" | "wastickers", siteUrl: string): Promise<{ bytes: Uint8Array; filename: string; contentType: string }> {
  if (!isBlobUrl(pack.trayUrl) || !pack.stickers.every((s) => isBlobUrl(s.url))) throw new AppError(502, "El paquete tiene archivos no válidos.");
  const [tray, stickers] = await Promise.all([
    fetchBytes(pack.trayUrl, WA.trayMaxBytes),
    Promise.all(pack.stickers.map(async (s) => ({ bytes: await fetchBytes(s.url, WA.animatedMaxBytes), emojis: s.emojis.slice(0, WA.maxEmojis) }))),
  ]);
  const base = pack.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "paquete";
  if (format === "wastickers") {
    return { bytes: await buildWastickers({ title: pack.title, publisher: pack.ownerName, stickers, tray }), filename: `${base}.wastickers`, contentType: "application/octet-stream" };
  }
  const credits = creditsToText(
    buildCredits({
      creatorName: pack.ownerName,
      username: pack.ownerUsername,
      createdAt: new Date(pack.createdAt),
      originality: pack.originality,
      thirdPartyNote: pack.thirdPartyNote,
      license: pack.license in LICENSES ? pack.license : "all-rights-reserved",
      siteUrl,
    }),
  );
  const bytes = await buildPackZip({ title: pack.title, publisher: pack.ownerName, animated: pack.animated, tray, credits, stickers });
  return { bytes, filename: `${base}.zip`, contentType: "application/zip" };
}
