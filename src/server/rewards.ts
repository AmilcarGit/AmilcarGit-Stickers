import { randomBytes } from "node:crypto";
import type { Deps } from "./deps";
import { AppError } from "./errors";
import { getUser, type UserRecord } from "./users";

const LIMA_OFFSET = -5 * 60 * 60 * 1000;
const dayKey = (now: number) => new Date(now + LIMA_OFFSET).toISOString().slice(0, 10).replace(/-/g, "");
const yesterday = (stamp: string) => {
  const d = new Date(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};

export type RewardBadge = { id: string; label: string; description: string; unlocked: boolean };

export async function prepareReferral(d: Deps, uid: string, rawCode?: unknown): Promise<{ referralCode: string; referredBy?: string }> {
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomBytes(5).toString("hex").toUpperCase();
    if (await d.store.set(`refcode:${candidate}`, uid, { nx: true })) { code = candidate; break; }
  }
  if (!code) throw new AppError(503, "No se pudo generar tu código de invitación. Inténtalo otra vez.");
  let referredBy: string | undefined;
  if (typeof rawCode === "string" && /^[A-Z0-9]{10}$/i.test(rawCode.trim())) {
    const referrer = await d.store.get<string>(`refcode:${rawCode.trim().toUpperCase()}`);
    if (referrer && referrer !== uid) referredBy = referrer;
  }
  return { referralCode: code, ...(referredBy ? { referredBy } : {}) };
}

export async function completeReferral(d: Deps, user: UserRecord): Promise<void> {
  if (!user.referredBy || user.referredBy === user.uid) return;
  const referrer = await getUser(d, user.referredBy);
  if (!referrer || !referrer.emailVerified || referrer.status === "suspended") return;
  const once = `referral:${user.uid}`;
  if (!(await d.store.set(`rewards:once:${once}`, "1", { nx: true }))) return;
  // La marca única impide que una verificación repetida duplique recompensas.
  const a = await d.store.hincrby("rewards:balances", user.uid, 25);
  const b = await d.store.hincrby("rewards:balances", referrer.uid, 50);
  await d.store.zadd("rewards:leaderboard", a, user.uid);
  await d.store.zadd("rewards:leaderboard", b, referrer.uid);
  for (const [uid, amount, reason] of [[user.uid, 25, "Registro por invitación"], [referrer.uid, 50, "Invitación verificada"]] as const) {
    const id = randomBytes(8).toString("hex");
    await d.store.set(`rewards:entry:${id}`, { at: Date.now(), amount, reason });
    await d.store.zadd(`rewards:history:${uid}`, Date.now(), id);
  }
  await d.store.sadd(`rewards:referrals:${referrer.uid}`, user.uid);
}

export async function claimDailyBonus(d: Deps, uid: string, now = Date.now()): Promise<{ points: number; streak: number; balance: number }> {
  const stamp = dayKey(now);
  if (!(await d.store.set(`rewards:daily:${uid}:${stamp}`, "1", { nx: true, ex: 3 * 86_400 }))) {
    throw new AppError(409, "Ya reclamaste tu bonificación de hoy. Vuelve mañana.");
  }
  const previous = await d.store.get<{ day: string; streak: number }>(`rewards:streak:${uid}`);
  const streak = previous?.day === yesterday(stamp) ? Math.min(previous.streak + 1, 30) : 1;
  const points = 10 + Math.min(streak - 1, 7);
  await d.store.set(`rewards:streak:${uid}`, { day: stamp, streak });
  const balance = await d.store.hincrby("rewards:balances", uid, points);
  await d.store.zadd("rewards:leaderboard", balance, uid);
  const id = randomBytes(8).toString("hex");
  await d.store.set(`rewards:entry:${id}`, { at: now, amount: points, reason: `Bonificación diaria · racha ${streak}` });
  await d.store.zadd(`rewards:history:${uid}`, now, id);
  return { points, streak, balance };
}

export async function getRewards(d: Deps, uid: string, now = Date.now()) {
  const [balance, referrals, streak, ids, rankIds] = await Promise.all([
    d.store.hget("rewards:balances", uid),
    d.store.smembers(`rewards:referrals:${uid}`),
    d.store.get<{ day: string; streak: number }>(`rewards:streak:${uid}`),
    d.store.zrange(`rewards:history:${uid}`, 0, 19, true),
    d.store.zrange("rewards:leaderboard", 0, 499, true),
  ]);
  const entries = await d.store.mget<{ at: number; amount: number; reason: string; balance?: number }>(ids.map((id) => `rewards:entry:${id}`));
  const today = dayKey(now);
  const claimedToday = (await d.store.get(`rewards:daily:${uid}:${today}`)) !== null;
  const user = await getUser(d, uid);
  const badges: RewardBadge[] = [
    { id: "first_points", label: "Primeros pasos", description: "Consigue tus primeros 10 puntos", unlocked: balance >= 10 },
    { id: "collector", label: "Coleccionista", description: "Alcanza 100 puntos", unlocked: balance >= 100 },
    { id: "ambassador", label: "Embajador", description: "Invita a 3 personas verificadas", unlocked: referrals.length >= 3 },
    { id: "streak_7", label: "Constancia", description: "Mantén una racha de 7 días", unlocked: (streak?.streak ?? 0) >= 7 },
    { id: "legend", label: "Leyenda", description: "Alcanza 1.000 puntos", unlocked: balance >= 1000 },
  ];
  const [boardUsers, pointValues] = await Promise.all([
    d.store.mget<UserRecord>(rankIds.map((id) => `user:${id}`)),
    Promise.all(rankIds.map((id) => d.store.hget("rewards:balances", id))),
  ]);
  const resolved = rankIds.flatMap((id, i) => {
    const u = boardUsers[i];
    if (!u || u.showInRanking === false) return [];
    return [{ rank: 0, username: u.username, displayName: u.displayName, verifiedBadge: u.verifiedBadge ?? null, points: pointValues[i] }];
  });
  resolved.sort((a, b) => b.points - a.points);
  resolved.forEach((entry, i) => { entry.rank = i + 1; });
  return {
    points: balance,
    referrals: referrals.length,
    referralCode: user?.referralCode ?? null,
    referralUrl: user?.referralCode ? `${d.siteUrl}/register?ref=${user.referralCode}` : null,
    daily: { claimed: claimedToday, streak: streak?.streak ?? 0, nextPoints: 10 + Math.min((streak?.streak ?? 0), 7) },
    badges,
    history: entries.filter((e): e is NonNullable<typeof e> => e !== null),
    leaderboard: resolved.slice(0, 10),
  };
}
