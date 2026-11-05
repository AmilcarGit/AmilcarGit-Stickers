import { createHash, randomInt, randomUUID } from "node:crypto";
import { AppError } from "./errors";

export const HASH_ALGOS = ["md5", "sha1", "sha256", "sha512"] as const;
export type HashAlgo = (typeof HASH_ALGOS)[number];

const MAX_TEXT = 10_000;

export function textParam(raw: string | null, name = "text"): string {
  if (raw === null || raw === "") throw new AppError(400, `Falta el parámetro «${name}».`);
  if (raw.length > MAX_TEXT) throw new AppError(400, `El parámetro «${name}» es demasiado largo (máximo ${MAX_TEXT} caracteres).`);
  return raw;
}

/** md5 y sha1 se ofrecen solo para sumas de comprobación; no sirven para guardar contraseñas. */
export function hashText(text: string, algo: string): { algorithm: HashAlgo; hash: string } {
  if (!(HASH_ALGOS as readonly string[]).includes(algo)) throw new AppError(400, `Algoritmo no válido. Usa: ${HASH_ALGOS.join(", ")}.`);
  return { algorithm: algo as HashAlgo, hash: createHash(algo).update(text, "utf8").digest("hex") };
}

export function uuids(count: number): string[] {
  const n = Math.min(50, Math.max(1, Number.isFinite(count) ? count : 1));
  return Array.from({ length: n }, () => randomUUID());
}

export function base64(text: string, mode: string): string {
  if (mode === "encode") return Buffer.from(text, "utf8").toString("base64");
  if (mode === "decode") {
    if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(text.trim())) throw new AppError(400, "El texto no es Base64 válido.");
    return Buffer.from(text.trim(), "base64").toString("utf8");
  }
  throw new AppError(400, "El parámetro «mode» debe ser encode o decode.");
}

const SETS = { lower: "abcdefghijklmnopqrstuvwxyz", upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", digits: "0123456789", symbols: "!@#$%^&*()-_=+[]{};:,.?" };

export function password(length: number, symbols: boolean): string {
  const len = Math.min(64, Math.max(8, Number.isFinite(length) ? length : 16));
  const sets = [SETS.lower, SETS.upper, SETS.digits, ...(symbols ? [SETS.symbols] : [])];
  const pool = sets.join("");
  // Garantiza al menos un carácter de cada grupo y rellena el resto al azar.
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < len) chars.push(pool[randomInt(pool.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
