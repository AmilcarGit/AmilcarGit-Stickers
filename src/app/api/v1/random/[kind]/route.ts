import { AppError } from "@/server/errors";
import { randomContent } from "@/server/content";
import { preflight, v1With } from "@/server/v1";

export const runtime = "nodejs";
export const OPTIONS = preflight;

const KINDS = ["anime", "meme", "wallpaper", "waifu", "quote", "fact", "joke", "cosplay"] as const;

export const GET = v1With<{ kind: string }>(async (_ctx, { kind }) => {
  if (!(KINDS as readonly string[]).includes(kind)) {
    throw new AppError(404, `Tipo aleatorio desconocido. Usa: ${KINDS.join(", ")}.`);
  }
  return { result: await randomContent(fetch, kind) };
});
