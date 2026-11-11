import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("OpenAPI generado desde ENDPOINTS", () => {
  it("expone la versión, autenticación y rutas reales del catálogo", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.components.securitySchemes.ApiKeyHeader).toMatchObject({
      type: "apiKey",
      in: "header",
      name: "x-api-key",
    });
    expect(spec.paths["/api/v1/weather"].get.operationId).toBe("weather");
    expect(spec.paths["/api/v1/sticker"].post.requestBody.required).toBe(true);
  });
});
