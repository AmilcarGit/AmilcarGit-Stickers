import { beforeEach, describe, expect, it } from "vitest";
import type { Deps } from "./deps";
import { MemoryStore } from "./memory-store";
import { saveProfile, toMe, type UserRecord } from "./users";

let store: MemoryStore;
let d: Deps;
let user: UserRecord;

beforeEach(async () => {
  store = new MemoryStore();
  d = {
    store,
    mailer: { configured: false, async send() {} },
    siteUrl: "https://yuiapi.test",
    adminEmails: [],
    secret: "s".repeat(40),
    secureCookies: true,
  };
  user = {
    uid: "u_profile",
    email: "profile@example.test",
    username: "perfil",
    displayName: "Perfil",
    createdAt: 1_790_000_000_000,
    passHash: "never-expose-this",
    emailVerified: true,
    plan: "pro",
    avatarV: 123,
  };
  await store.set("user:u_profile", user);
});

describe("perfil personal", () => {
  it("guarda biografía y ubicación con límites y conserva el resto de la cuenta", async () => {
    const updated = await saveProfile(d, user.uid, {
      displayName: "  Nuevo nombre  ",
      bio: "x".repeat(200),
      location: "y".repeat(80),
    });

    expect(updated.displayName).toBe("Nuevo nombre");
    expect(updated.bio).toHaveLength(160);
    expect(updated.location).toHaveLength(60);
    expect(updated.email).toBe(user.email);
    expect(updated.passHash).toBe(user.passHash);
    expect(updated.plan).toBe("pro");
    expect(updated.avatarV).toBe(123);
  });

  it("incluye los campos de perfil en la respuesta propia sin exponer secretos", async () => {
    await saveProfile(d, user.uid, { bio: "Desarrollador", location: "Perú" });
    const me = toMe(d, (await store.get<UserRecord>("user:u_profile"))!);

    expect(me.bio).toBe("Desarrollador");
    expect(me.location).toBe("Perú");
    expect(me.email).toBe(user.email);
    expect(me).not.toHaveProperty("passHash");
    expect(me).not.toHaveProperty("uid", "never-expose-this");
  });
});
