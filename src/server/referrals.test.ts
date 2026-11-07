import { beforeEach, describe, expect, it } from "vitest";
import type { Deps } from "./deps";
import type { Mail } from "./mailer";
import { MemoryStore } from "./memory-store";
import { getRewards } from "./rewards";
import { registerUser, verifyEmail } from "./users";

let store: MemoryStore;
let d: Deps;
let sent: Mail[];

const register = (email: string, username: string, referralCode?: string) =>
  registerUser(d, { email, username, password: "Segura123", displayName: username, referralCode }, "10.0.0.1");

const tokenFrom = (mail: Mail) => /token=([a-f0-9]+)/.exec(mail.text)?.[1] ?? "";

beforeEach(() => {
  store = new MemoryStore();
  sent = [];
  d = {
    store,
    mailer: { configured: true, async send(mail) { sent.push(mail); } },
    siteUrl: "https://yuiapi.test",
    adminEmails: [],
    secret: "s".repeat(40),
    secureCookies: true,
  };
});

describe("invitaciones", () => {
  it("recompensa una sola vez al invitador y al nuevo usuario tras verificar correo", async () => {
    const inviter = await register("invita@x.test", "invita");
    await verifyEmail(d, tokenFrom(sent[0]));
    const invited = await register("nuevo@x.test", "nuevo", inviter.user.referralCode);
    await verifyEmail(d, tokenFrom(sent[1]));

    const inviterRewards = await getRewards(d, inviter.user.uid);
    const invitedRewards = await getRewards(d, invited.user.uid);
    expect(inviterRewards.points).toBe(50);
    expect(inviterRewards.referrals).toBe(1);
    expect(invitedRewards.points).toBe(25);
  });
});
