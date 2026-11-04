import { describe, expect, it } from "vitest";
import { authErrorMessage, clamp, normalizeUsername, safeNext, validateEmail, validatePassword, validateUsername } from "./validators";

describe("safeNext", () => {
  it("acepta rutas internas y rechaza redirecciones externas", () => {
    expect(safeNext("/editor?project=1")).toBe("/editor?project=1");
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("https://malo.com")).toBe("/dashboard");
    expect(safeNext("//malo.com")).toBe("/dashboard");
    expect(safeNext("/\\malo.com")).toBe("/dashboard");
  });
});

describe("validateUsername", () => {
  it("acepta nombres válidos, con o sin @ y mayúsculas", () => {
    expect(validateUsername("amilcar_01")).toBeNull();
    expect(validateUsername("@Amilcar")).toBeNull();
    expect(normalizeUsername("  @Amilcar ")).toBe("amilcar");
  });

  it("rechaza cortos, largos y con símbolos", () => {
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("a".repeat(21))).not.toBeNull();
    expect(validateUsername("hola mundo")).not.toBeNull();
    expect(validateUsername("hola-mundo")).not.toBeNull();
  });
});

describe("validateEmail", () => {
  it("valida el formato básico", () => {
    expect(validateEmail("a@b.co")).toBeNull();
    expect(validateEmail("sin-arroba")).not.toBeNull();
    expect(validateEmail("a@b")).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("exige 8 caracteres, letras y número", () => {
    expect(validatePassword("corta1")).not.toBeNull();
    expect(validatePassword("sololetras")).not.toBeNull();
    expect(validatePassword("12345678")).not.toBeNull();
    expect(validatePassword("Segura123")).toBeNull();
  });
});

describe("authErrorMessage", () => {
  it("traduce códigos conocidos y tiene mensaje por defecto", () => {
    expect(authErrorMessage("auth/email-already-in-use")).toContain("ya tiene una cuenta");
    expect(authErrorMessage("auth/invalid-credential")).toContain("incorrectos");
    expect(authErrorMessage("otro")).toContain("No se pudo");
  });
});

describe("clamp", () => {
  it("limita al rango", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
