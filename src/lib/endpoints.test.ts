import { describe, expect, it } from "vitest";
import { ENDPOINTS, buildUrl, curlFor } from "./endpoints";

describe("catálogo de endpoints", () => {
  it("ids y rutas son únicos y todas cuelgan de /api/v1", () => {
    expect(new Set(ENDPOINTS.map((e) => e.id)).size).toBe(ENDPOINTS.length);
    expect(new Set(ENDPOINTS.map((e) => e.path)).size).toBe(ENDPOINTS.length);
    expect(ENDPOINTS.every((e) => e.path.startsWith("/api/v1/"))).toBe(true);
  });

  it("buildUrl omite vacíos y codifica", () => {
    const e = ENDPOINTS.find((x) => x.id === "music")!;
    expect(buildUrl(e, { q: "a b&c", limit: "" })).toBe("/api/v1/search/music?q=a+b%26c");
    expect(buildUrl(ENDPOINTS.find((x) => x.id === "me")!, {})).toBe("/api/v1/me");
  });

  it("curl usa marcador de clave y -o para imágenes", () => {
    const qr = ENDPOINTS.find((x) => x.id === "qr")!;
    expect(curlFor(qr, { text: "hi" }, "https://x.test")).toBe('curl -H "x-api-key: TU_CLAVE" "https://x.test/api/v1/tools/qr?text=hi" -o resultado.png');
    expect(curlFor(ENDPOINTS[0], {}, "https://x.test")).toContain("--data-binary @foto.jpg");
  });
});
