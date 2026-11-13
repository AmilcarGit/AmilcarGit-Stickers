import { AppError } from "@/server/errors";
import { cleanLimit, cleanQuery } from "@/server/external";
import { dragonBallCharacter, dragonBallCharacters, dragonBallPlanets } from "@/server/content";
import { preflight, v1With } from "@/server/v1";

export const runtime = "nodejs";
export const OPTIONS = preflight;

export const GET = v1With<{ resource: string }>(async ({ url }, { resource }) => {
  if (resource === "characters") {
    const raw = url.searchParams.get("q");
    const query = raw?.trim() ? cleanQuery(raw, 80) : null;
    const limit = cleanLimit(url.searchParams.get("limit"), 10, 25);
    return { results: await dragonBallCharacters(fetch, query, limit), source: "Dragon Ball API (comunidad)" };
  }
  if (resource === "character") {
    const id = url.searchParams.get("id")?.trim();
    if (!id) throw new AppError(400, "Falta el parámetro id.");
    return { character: await dragonBallCharacter(fetch, id), source: "Dragon Ball API (comunidad)" };
  }
  if (resource === "planets") {
    const limit = cleanLimit(url.searchParams.get("limit"), 10, 25);
    return { results: await dragonBallPlanets(fetch, limit), source: "Dragon Ball API (comunidad)" };
  }
  if (resource === "random") {
    const characters = await dragonBallCharacters(fetch, null, 25);
    if (!characters.length) throw new AppError(404, "No hay personajes disponibles en este momento.");
    return { character: characters[Math.floor(Math.random() * characters.length)], source: "Dragon Ball API (comunidad)" };
  }
  throw new AppError(404, "Recurso Dragon Ball desconocido. Usa characters, character, planets o random.");
});
