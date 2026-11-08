import { getWeather } from "@/server/utility";
import { preflight, v1 } from "@/server/v1";

export const runtime = "nodejs";
export const maxDuration = 20;
export const OPTIONS = preflight;

/** Clima actual y pronóstico de 3 días: /weather?city=Lima&lang=es (Open-Meteo). */
export const GET = v1(async ({ url }) => getWeather(fetch, url.searchParams.get("city"), url.searchParams.get("lang") ?? "es"));
