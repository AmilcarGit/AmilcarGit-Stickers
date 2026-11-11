import { describe, expect, it } from "vitest";
import { getApiMetrics, recordApiMetric } from "./metrics";

describe("métricas locales de API", () => {
  it("agrupa solicitudes, errores y percentiles por ruta", () => {
    const now = Date.now();
    recordApiMetric("/api/v1/search/test-metrics", 200, 40, now);
    recordApiMetric("/api/v1/search/test-metrics", 502, 120, now + 1);
    const snapshot = getApiMetrics(now + 2);
    const endpoint = snapshot.endpoints.find((row) => row.path === "/api/v1/search/test-metrics");
    expect(snapshot.scope).toBe("instance");
    expect(snapshot.totalRequests).toBeGreaterThanOrEqual(2);
    expect(snapshot.errors).toBeGreaterThanOrEqual(1);
    expect(endpoint).toMatchObject({ requests: 2, errors: 1, averageMs: 80, p95Ms: 120, errorRate: 50 });
  });
});
