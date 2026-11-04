import type { Store } from "./store";

/** Almacén en memoria con el mismo comportamiento que Redis para lo que usa la app. Solo pruebas. */
export class MemoryStore implements Store {
  private kv = new Map<string, { value: string; exp: number | null }>();
  private zsets = new Map<string, Map<string, number>>();
  private sets = new Map<string, Set<string>>();
  private hashes = new Map<string, Record<string, number>>();

  constructor(private readonly now: () => number = Date.now) {}

  private alive(key: string): { value: string; exp: number | null } | undefined {
    const e = this.kv.get(key);
    if (e && e.exp !== null && e.exp <= this.now()) {
      this.kv.delete(key);
      return undefined;
    }
    return e;
  }

  async get<T>(key: string): Promise<T | null> {
    const e = this.alive(key);
    return e ? (JSON.parse(e.value) as T) : null;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }

  async set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<boolean> {
    if (opts?.nx && this.alive(key)) return false;
    this.kv.set(key, { value: JSON.stringify(value), exp: opts?.ex ? this.now() + opts.ex * 1000 : null });
    return true;
  }

  async del(...keys: string[]): Promise<void> {
    for (const k of keys) {
      this.kv.delete(k);
      this.zsets.delete(k);
      this.sets.delete(k);
      this.hashes.delete(k);
    }
  }

  async incr(key: string): Promise<number> {
    const e = this.alive(key);
    const n = (e ? Number(JSON.parse(e.value)) : 0) + 1;
    this.kv.set(key, { value: JSON.stringify(n), exp: e?.exp ?? null });
    return n;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const e = this.alive(key);
    if (e) e.exp = this.now() + seconds * 1000;
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    if (!this.zsets.has(key)) this.zsets.set(key, new Map());
    this.zsets.get(key)?.set(member, score);
  }

  async zrem(key: string, member: string): Promise<void> {
    this.zsets.get(key)?.delete(member);
  }

  async zrange(key: string, start: number, stop: number, rev = false): Promise<string[]> {
    const sorted = [...(this.zsets.get(key) ?? new Map<string, number>()).entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([m]) => m);
    if (rev) sorted.reverse();
    const end = stop < 0 ? sorted.length + stop + 1 : stop + 1;
    return sorted.slice(start, end);
  }

  async zcard(key: string): Promise<number> {
    return this.zsets.get(key)?.size ?? 0;
  }

  async sadd(key: string, member: string): Promise<void> {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    this.sets.get(key)?.add(member);
  }

  async srem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.delete(member);
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? [])];
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return this.sets.get(key)?.has(member) ?? false;
  }

  async hincrby(key: string, field: string, by: number): Promise<number> {
    const h = this.hashes.get(key) ?? {};
    h[field] = (h[field] ?? 0) + by;
    this.hashes.set(key, h);
    return h[field];
  }

  async hget(key: string, field: string): Promise<number> {
    return this.hashes.get(key)?.[field] ?? 0;
  }

  async hgetall(key: string): Promise<Record<string, number>> {
    return { ...(this.hashes.get(key) ?? {}) };
  }
}
