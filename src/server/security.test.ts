import { beforeEach, describe, expect, it } from "vitest";
import type { Deps } from "./deps";
import { MemoryStore } from "./memory-store";
import { blockIp, isIpBlocked, normalizeSecurityIp, securitySnapshot, unblockIp } from "./security";

describe("centro de seguridad", () => {
  let store: MemoryStore;
  let d: Deps;

  beforeEach(() => {
    store = new MemoryStore();
    d = {
      store,
      mailer: { configured: false, async send() {} },
      siteUrl: "https://security.test",
      adminEmails: [],
      secret: "s".repeat(40),
      secureCookies: true,
    };
  });

  it("bloquea una IP hasta que se desbloquea", async () => {
    await blockIp(d, "203.0.113.10", 600, "Actividad sospechosa");
    expect(await isIpBlocked(d, "203.0.113.10")).toMatchObject({ reason: "Actividad sospechosa" });
    await unblockIp(d, "203.0.113.10");
    expect(await isIpBlocked(d, "203.0.113.10")).toBeNull();
  });

  it("rechaza IP y duraciones inválidas", async () => {
    expect(() => normalizeSecurityIp("not-an-ip")).toThrow();
    await expect(blockIp(d, "203.0.113.10", 10)).rejects.toThrow();
    await expect(blockIp(d, "203.0.113.10", 2_592_001)).rejects.toThrow();
  });

  it("muestra eventos recientes y bloques activos", async () => {
    await blockIp(d, "2001:db8::1", 3600, "Prueba");
    const snapshot = await securitySnapshot(d);
    expect(snapshot.blocks).toHaveLength(1);
    expect(snapshot.events[0]).toMatchObject({ type: "ip_blocked", severity: "critical" });
  });
});
