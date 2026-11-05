import { describe, expect, it } from "vitest";
import { base64, hashText, password, textParam, uuids } from "./tools";

describe("herramientas", () => {
  it("hash conocido y algoritmo no válido", () => {
    expect(hashText("hola", "sha256").hash).toBe("b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79");
    expect(hashText("", "md5").hash).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(() => hashText("x", "sha3")).toThrow();
  });

  it("textParam exige y acota el texto", () => {
    expect(() => textParam(null)).toThrow();
    expect(() => textParam("")).toThrow();
    expect(() => textParam("x".repeat(10_001))).toThrow();
    expect(textParam("ok")).toBe("ok");
  });

  it("base64 ida y vuelta y validación", () => {
    expect(base64("¡Hola!", "encode")).toBe("wqFIb2xhIQ==");
    expect(base64("wqFIb2xhIQ==", "decode")).toBe("¡Hola!");
    expect(() => base64("%%%", "decode")).toThrow();
    expect(() => base64("a", "otro")).toThrow();
  });

  it("uuid: cantidad acotada y únicos", () => {
    const ids = uuids(5);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(uuids(999)).toHaveLength(50);
    expect(uuids(0)).toHaveLength(1);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("contraseña: largo acotado y con todos los grupos de caracteres", () => {
    for (let i = 0; i < 30; i++) {
      const p = password(20, true);
      expect(p).toHaveLength(20);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[^a-zA-Z0-9]/);
    }
    expect(password(3, false)).toHaveLength(8);
    expect(password(500, false)).toHaveLength(64);
    expect(password(30, false)).toMatch(/^[a-zA-Z0-9]+$/);
  });
});
