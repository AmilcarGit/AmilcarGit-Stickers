import { translateText } from "@/server/utility";
import { preflight, v1 } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 20;
export const OPTIONS = preflight;

/** Traductor: /translate?text=Hola&to=en&from=auto (máx. 500 caracteres). */
export const GET = v1(async ({ url }) => {
  const sp = url.searchParams;
  return translateText(fetch, sp.get("text"), sp.get("to"), sp.get("from"));
});
