export type ApiMetricSample = { at: number; durationMs: number; status: number };
export type ApiEndpointMetric = {
  path: string;
  requests: number;
  errors: number;
  averageMs: number;
  p95Ms: number;
  errorRate: number;
};
export type ApiMetricsSnapshot = {
  scope: "instance";
  windowSeconds: number;
  collectedAt: number;
  totalRequests: number;
  requestsPerMinute: number;
  errors: number;
  averageMs: number;
  p95Ms: number;
  endpoints: ApiEndpointMetric[];
};

const WINDOW_MS = 5 * 60_000;
const MAX_PATHS = 30;
const MAX_SAMPLES_PER_PATH = 200;
const samples = new Map<string, ApiMetricSample[]>();

function normalizePath(path: string): string {
  return path.replace(/\/[0-9a-f]{16,}(?=\/|$)/gi, "/:id").replace(/\/\d+(?=\/|$)/g, "/:id");
}

export function recordApiMetric(path: string, status: number, durationMs: number, at = Date.now()): void {
  const key = normalizePath(path);
  let rows = samples.get(key);
  if (!rows) {
    if (samples.size >= MAX_PATHS) {
      const oldest = samples.keys().next().value;
      if (oldest) samples.delete(oldest);
    }
    rows = [];
    samples.set(key, rows);
  }
  rows.push({ at, durationMs: Math.max(0, durationMs), status });
  if (rows.length > MAX_SAMPLES_PER_PATH) rows.splice(0, rows.length - MAX_SAMPLES_PER_PATH);
  const cutoff = at - WINDOW_MS;
  while (rows.length && rows[0].at < cutoff) rows.shift();
}

export function getApiMetrics(now = Date.now()): ApiMetricsSnapshot {
  const cutoff = now - WINDOW_MS;
  const recent: Array<ApiMetricSample & { path: string }> = [];
  for (const [path, rows] of samples) {
    const active = rows.filter((row) => row.at >= cutoff);
    if (active.length) {
      samples.set(path, active);
      recent.push(...active.map((row) => ({ ...row, path })));
    } else {
      samples.delete(path);
    }
  }
  const durations = recent.map((row) => row.durationMs).sort((a, b) => a - b);
  const errors = recent.filter((row) => row.status >= 400).length;
  const lastMinute = recent.filter((row) => row.at >= now - 60_000).length;
  const percentile = durations.length ? durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)] : 0;
  const endpoints = Array.from(samples.entries()).map(([path, rows]) => {
    const times = rows.map((row) => row.durationMs).sort((a, b) => a - b);
    const endpointErrors = rows.filter((row) => row.status >= 400).length;
    return {
      path,
      requests: rows.length,
      errors: endpointErrors,
      averageMs: Math.round(times.reduce((sum, value) => sum + value, 0) / Math.max(1, times.length)),
      p95Ms: times.length ? times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)] : 0,
      errorRate: rows.length ? Math.round((endpointErrors / rows.length) * 100) : 0,
    };
  }).sort((a, b) => b.p95Ms - a.p95Ms).slice(0, 12);
  return {
    scope: "instance",
    windowSeconds: 300,
    collectedAt: now,
    totalRequests: recent.length,
    requestsPerMinute: lastMinute,
    errors,
    averageMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    p95Ms: percentile,
    endpoints,
  };
}
