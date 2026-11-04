import { Redis } from "@upstash/redis";
import { ConfigError } from "./errors";

/**
 * Operaciones de base de datos que usa la app. Hay dos implementaciones:
 * Upstash Redis (producción) y una en memoria (pruebas), así la lógica se prueba sin red.
 */
export interface Store {
  get<T>(key: string): Promise<T | null>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  /** Devuelve true si se escribió (con `nx`, false si la clave ya existía). */
  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrem(key: string, member: string): Promise<void>;
  zrange(key: string, start: number, stop: number, rev?: boolean): Promise<string[]>;
  zcard(key: string): Promise<number>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;
  hincrby(key: string, field: string, by: number): Promise<number>;
  hget(key: string, field: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, number>>;
}

export class UpstashStore implements Store {
  constructor(private readonly r: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const v = await this.r.get<T>(key);
    return v ?? null;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const v = await this.r.mget<(T | null)[]>(...keys);
    return v.map((x) => x ?? null);
  }

  async set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<boolean> {
    let res: unknown;
    if (opts?.nx && opts.ex) res = await this.r.set(key, value, { nx: true, ex: opts.ex });
    else if (opts?.nx) res = await this.r.set(key, value, { nx: true });
    else if (opts?.ex) res = await this.r.set(key, value, { ex: opts.ex });
    else res = await this.r.set(key, value);
    return res === "OK";
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.r.del(...keys);
  }

  incr(key: string): Promise<number> {
    return this.r.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.r.expire(key, seconds);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.r.zadd(key, { score, member });
  }

  async zrem(key: string, member: string): Promise<void> {
    await this.r.zrem(key, member);
  }

  async zrange(key: string, start: number, stop: number, rev = false): Promise<string[]> {
    const out = rev ? await this.r.zrange<string[]>(key, start, stop, { rev: true }) : await this.r.zrange<string[]>(key, start, stop);
    return out.map(String);
  }

  zcard(key: string): Promise<number> {
    return this.r.zcard(key);
  }

  async sadd(key: string, member: string): Promise<void> {
    await this.r.sadd(key, member);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.r.srem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    const out = await this.r.smembers<string[]>(key);
    return out.map(String);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.r.sismember(key, member)) === 1;
  }

  hincrby(key: string, field: string, by: number): Promise<number> {
    return this.r.hincrby(key, field, by);
  }

  async hget(key: string, field: string): Promise<number> {
    const v = await this.r.hget<number>(key, field);
    return Number(v) || 0;
  }

  async hgetall(key: string): Promise<Record<string, number>> {
    const raw = await this.r.hgetall<Record<string, unknown>>(key);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw ?? {})) out[k] = Number(v) || 0;
    return out;
  }
}

let cached: Store | null = null;

/** Conexión a Upstash a partir de UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN. */
export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new ConfigError("La base de datos no está configurada (faltan UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN).");
  }
  cached = new UpstashStore(new Redis({ url, token }));
  return cached;
}

/** Solo para pruebas. */
export function setStoreForTests(store: Store | null): void {
  cached = store;
}

/** Límite por ventana fija: true si la acción está permitida. Funciona entre instancias serverless. */
export async function hit(store: Store, key: string, max: number, windowSeconds: number): Promise<boolean> {
  const n = await store.incr(key);
  if (n === 1) await store.expire(key, windowSeconds);
  return n <= max;
}
