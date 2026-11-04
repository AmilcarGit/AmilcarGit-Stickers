import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("permite hasta el máximo y bloquea el exceso", () => {
    expect(rateLimit("u1", 2, 1000, 0)).toBe(true);
    expect(rateLimit("u1", 2, 1000, 10)).toBe(true);
    expect(rateLimit("u1", 2, 1000, 20)).toBe(false);
  });

  it("libera cuando termina la ventana", () => {
    rateLimit("u1", 1, 1000, 0);
    expect(rateLimit("u1", 1, 1000, 500)).toBe(false);
    expect(rateLimit("u1", 1, 1000, 1500)).toBe(true);
  });

  it("separa a cada usuario", () => {
    rateLimit("u1", 1, 1000, 0);
    expect(rateLimit("u2", 1, 1000, 0)).toBe(true);
  });
});
