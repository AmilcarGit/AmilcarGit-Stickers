import { describe, expect, it } from "vitest";
import { ENDPOINTS, buildUrl, curlFor, jsFor, pythonFor } from "./endpoints";

describe("catálogo de endpoints", () => {
  it("ids y rutas son únicos y todas cuelgan de /api/v1", () => {
    expect(new Set(ENDPOINTS.map((e) => e.id)).size).toBe(ENDPOINTS.length);
    expect(new Set(ENDPOINTS.map((e) => e.path)).size).toBe(ENDPOINTS.length);
    expect(ENDPOINTS.every((e) => e.path.startsWith("/api/v1/"))).toBe(true);
  });

  it("incluye las nuevas familias de archivos, imágenes y desarrollo", () => {
    expect(ENDPOINTS.some((e) => e.path === "/api/v1/tools/file-info")).toBe(true);
    expect(ENDPOINTS.some((e) => e.path === "/api/v1/tools/image-resize")).toBe(true);
    expect(ENDPOINTS.some((e) => e.path === "/api/v1/tools/json-format")).toBe(true);
    expect(ENDPOINTS.some((e) => e.path === "/api/v1/tools/url-encode")).toBe(true);
  });

  it("buildUrl omite vacíos y codifica", () => {
    const e = ENDPOINTS.find((x) => x.id === "music")!;
    expect(buildUrl(e, { q: "a b&c", limit: "" })).toBe("/api/v1/search/music?q=a+b%26c");
    expect(buildUrl(ENDPOINTS.find((x) => x.id === "me")!, {})).toBe("/api/v1/me");
  });

  it("genera ejemplos seguros en curl, JavaScript y Python", () => {
    const qr = ENDPOINTS.find((x) => x.id === "qr")!;
    expect(curlFor(qr, { text: "hi" }, "https://x.test")).toBe('curl -H "x-api-key: TU_CLAVE" "https://x.test/api/v1/tools/qr?text=hi" -o resultado');
    const image = ENDPOINTS.find((x) => x.id === "image-resize")!;
    expect(jsFor(image, { width: "512" }, "https://x.test")).toContain('method: "POST"');
    expect(pythonFor(image, {}, "https://x.test")).toContain("requests.post");
    expect(curlFor(image, {}, "https://x.test")).toContain("--data-binary @archivo");
  });
});
