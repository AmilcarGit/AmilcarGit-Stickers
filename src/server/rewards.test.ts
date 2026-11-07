import { beforeEach, describe, expect, it } from "vitest";
import type { Deps } from "./deps";
import { MemoryStore } from "./memory-store";
import { claimDailyBonus, getRewards } from "./rewards";
import { AppError } from "./errors";

let store: MemoryStore;
let d: Deps;

beforeEach(() => {
  store = new MemoryStore();
  d = {
    store,
    mailer: { configured: false, async send() {} },
    siteUrl: "https://yuiapi.test",
    adminEmails: [],
    secret: "s".repeat(40),
    secureCookies: true,
  };
});

describe("recompensas", () => {
  it("entrega la bonificación diaria una sola vez y mantiene la racha", async () => {
    const first = await claimDailyBonus(d, "u_1", Date.parse("2026-11-01T15:00:00Z"));
    expect(first.points).toBe(10);
    expect(first.streak).toBe(1);
    await expect(claimDailyBonus(d, "u_1", Date.parse("2026-11-01T18:00:00Z"))).rejects.toBeInstanceOf(AppError);
    const second = await claimDailyBonus(d, "u_1", Date.parse("2026-11-02T15:00:00Z"));
    expect(second.streak).toBe(2);
    expect(second.points).toBe(11);
    expect(second.balance).toBe(21);
  });

  it("expone saldo, historial e insignias derivadas del saldo real", async () => {
    await claimDailyBonus(d, "u_1", Date.parse("2026-11-01T15:00:00Z"));
    const rewards = await getRewards(d, "u_1", Date.parse("2026-11-01T16:00:00Z"));
    expect(rewards.points).toBe(10);
    expect(rewards.daily.claimed).toBe(true);
    expect(rewards.badges.find((badge) => badge.id === "first_points")?.unlocked).toBe(true);
    expect(rewards.history).toHaveLength(1);
  });
});
