import { describe, expect, it } from "vitest";
import { buildCredits, creditsToText } from "./credits";

const base = {
  creatorName: "Amilcar",
  username: "amilcar",
  createdAt: new Date("2026-11-03T12:00:00Z"),
  originality: "original" as const,
  license: "cc-by" as const,
  siteUrl: "https://example.com/",
};

describe("buildCredits", () => {
  it("arma la ficha con fecha, perfil y licencia", () => {
    const c = buildCredits(base);
    expect(c.creator).toBe("Amilcar");
    expect(c.date).toBe("2026-11-03");
    expect(c.profileUrl).toBe("https://example.com/u/amilcar");
    expect(c.licenseLabel).toBe("CC BY 4.0");
    expect(c.thirdPartyNote).toBe("");
  });

  it("usa el nombre de usuario si no hay nombre de creador", () => {
    expect(buildCredits({ ...base, creatorName: "  " }).creator).toBe("amilcar");
  });

  it("conserva la nota solo cuando hay recursos de terceros", () => {
    expect(buildCredits({ ...base, thirdPartyNote: "foto de X" }).thirdPartyNote).toBe("");
    const t = buildCredits({ ...base, originality: "third-party", thirdPartyNote: " foto de X " });
    expect(t.thirdPartyNote).toBe("foto de X");
  });
});

describe("creditsToText", () => {
  it("incluye el formato CREADOR / WEB / AUTORÍA / FECHA y el aviso", () => {
    const text = creditsToText(buildCredits(base));
    expect(text).toContain("CREADOR: Amilcar");
    expect(text).toContain("WEB: AmilcarGit-Stickers");
    expect(text).toContain("AUTORÍA: Creado con AmilcarGit-Stickers");
    expect(text).toContain("FECHA: 2026-11-03");
    expect(text).toContain("no constituyen protección legal");
  });
});
