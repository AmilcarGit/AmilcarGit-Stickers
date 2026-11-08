import { describe, expect, it } from "vitest";
import { convertCurrency, describeWeather, getWeather, translateText } from "./utility";

const jsonFetch = (routes: Record<string, unknown>, status = 200): typeof fetch =>
  (async (input: string | URL | Request) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.includes(k));
    return new Response(JSON.stringify(key ? routes[key] : {}), { status });
  }) as unknown as typeof fetch;

async function fails(p: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await p;
  } catch (e) {
    const err = e as { status?: number; message: string };
    return { status: err.status ?? 0, message: err.message };
  }
  throw new Error("Se esperaba un error.");
}

describe("clima", () => {
  const ok = jsonFetch({
    "geocoding-api": { results: [{ name: "Lima", admin1: "Lima", country: "Perú", latitude: -12.04, longitude: -77.03 }] },
    "api.open-meteo.com": {
      timezone: "America/Lima",
      current: { temperature_2m: 19.5, apparent_temperature: 19, relative_humidity_2m: 80, wind_speed_10m: 11, weather_code: 3, is_day: 1 },
      daily: { time: ["2026-11-08", "2026-11-09"], weather_code: [3, 61], temperature_2m_max: [22, 21], temperature_2m_min: [17, 16], precipitation_probability_max: [5, 40] },
    },
  });

  it("devuelve clima actual y pronóstico en español", async () => {
    const w = await getWeather(ok, "Lima");
    expect(w.place).toMatchObject({ name: "Lima", country: "Perú", timezone: "America/Lima" });
    expect(w.current).toMatchObject({ temperatureC: 19.5, description: "Nublado", isDay: true });
    expect(w.forecast).toHaveLength(2);
    expect(w.forecast[1]).toMatchObject({ date: "2026-11-09", description: "Lluvia ligera", rainChancePct: 40 });
    expect(w.attribution).toContain("Open-Meteo");
  });

  it("valida la ciudad y responde 404 si no existe", async () => {
    expect((await fails(getWeather(ok, ""))).status).toBe(400);
    expect((await fails(getWeather(jsonFetch({ "geocoding-api": {} }), "Zzzzz"))).status).toBe(404);
  });

  it("código desconocido no rompe", () => {
    expect(describeWeather(12345).text).toBe("Desconocido");
    expect(describeWeather(null).icon).toBe("❔");
  });
});

describe("tipo de cambio", () => {
  const rates = jsonFetch({ "latest/USD": { result: "success", time_last_update_utc: "Sun, 08 Nov 2026 00:02:31 +0000", rates: { PEN: 3.5, EUR: 0.9 } } });

  it("convierte y redondea", async () => {
    const r = await convertCurrency(rates, "usd", "pen", "10");
    expect(r).toMatchObject({ from: "USD", to: "PEN", amount: 10, rate: 3.5, result: 35 });
    expect(r.attribution).toContain("ExchangeRate-API");
  });

  it("USD por defecto, monto 1 y coma decimal", async () => {
    expect((await convertCurrency(rates, null, "PEN", null)).result).toBe(3.5);
    expect((await convertCurrency(rates, "USD", "PEN", "2,5")).result).toBe(8.75);
  });

  it("valida códigos, montos y monedas sin tasa", async () => {
    expect((await fails(convertCurrency(rates, "USD", "peso", "1"))).status).toBe(400);
    expect((await fails(convertCurrency(rates, "USD", "PEN", "-3"))).status).toBe(400);
    expect((await fails(convertCurrency(rates, "USD", "XXX", "1"))).status).toBe(404);
    expect((await fails(convertCurrency(jsonFetch({ "latest/": { result: "error" } }), "ZZZ", "PEN", "1"))).status).toBe(404);
  });
});

describe("traductor", () => {
  const mm = (text: string, status = 200) => jsonFetch({ "mymemory": { responseStatus: status, responseData: { translatedText: text } } });

  it("traduce con detección automática", async () => {
    let seen = "";
    const spy = (async (input: string | URL | Request) => {
      seen = String(input);
      return new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: "Hello world" } }));
    }) as unknown as typeof fetch;
    const r = await translateText(spy, "Hola mundo", "en", "auto");
    expect(r).toMatchObject({ from: "auto", to: "en", translation: "Hello world" });
    expect(decodeURIComponent(seen)).toContain("langpair=Autodetect|en");
  });

  it("valida texto, idioma y longitud", async () => {
    expect((await fails(translateText(mm("x"), "", "en", null))).status).toBe(400);
    expect((await fails(translateText(mm("x"), "hola", "inglés!", null))).status).toBe(400);
    expect((await fails(translateText(mm("x"), "a".repeat(501), "en", null))).status).toBe(400);
  });

  it("límite diario del proveedor → 503; respuestas inválidas → 502/400", async () => {
    expect((await fails(translateText(mm("", 429), "hola", "en", null))).status).toBe(503);
    expect((await fails(translateText(jsonFetch({ mymemory: {} }), "hola", "en", null))).status).toBe(502);
    expect((await fails(translateText(mm("INVALID TARGET LANGUAGE"), "hola", "en", null))).status).toBe(400);
  });
});
