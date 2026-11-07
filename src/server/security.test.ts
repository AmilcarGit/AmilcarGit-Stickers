import { beforeEach, describe, expect, it } from "vitest";
import { makeDeps } from "./test-helpers";
import { MemoryStore } from "./memory-store";
import { blockIp, isIpBlocked, normalizeSecurityIp, securitySnapshot, unblockIp } from "./security";

describe("centro de seguridad", () => {
  let store: MemoryStore;
  let d: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    store = new MemoryStore();
    d = makeDeps({ store });
  });

  it("bloquea una IP hasta que vence o se desbloquea", async () => {
    await blockIp(d, "203.0.113.10", 600, "Actividad sospechosa", 1_000);
    expect(await isIpBlocked(d, "203.0.113.10")).toMatchObject({ reason: "Actividad sospechosa" });
    await unblockIp(d, "203.0.113.10", 2_000);
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
