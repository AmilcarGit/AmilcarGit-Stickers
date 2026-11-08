import { convertCurrency } from "@/server/utility";
import { preflight, v1 } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 20;
export const OPTIONS = preflight;

/** Tipo de cambio: /exchange?from=USD&to=PEN&amount=10 (tasas abiertas, una actualización al día). */
export const GET = v1(async ({ url }) => {
  const sp = url.searchParams;
  return convertCurrency(fetch, sp.get("from"), sp.get("to"), sp.get("amount"));
});
