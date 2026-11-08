import { AppError } from "./errors";

/** Utilidades para bots (clima, tipo de cambio, traducción). Cada función recibe `fetch` para probarse sin red. */
export type Fetcher = typeof fetch;

const UA = "YuiApi/1.0 (+https://yuiapi.vercel.app)";

async function getJson(f: Fetcher, url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await f(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new AppError(502, "El servicio externo no respondió a tiempo. Inténtalo otra vez.");
  }
  if (res.status === 429) throw new AppError(503, "El servicio externo está limitando las consultas. Inténtalo en unos minutos.");
  if (!res.ok) throw new AppError(502, "El servicio externo devolvió un error.");
  try {
    return JSON.parse((await res.text()).slice(0, 1_000_000));
  } catch {
    throw new AppError(502, "El servicio externo devolvió datos no válidos.");
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/* --------------------------------- Clima --------------------------------- */

const WMO: Record<number, [string, string]> = {
  0: ["Despejado", "☀️"], 1: ["Mayormente despejado", "🌤️"], 2: ["Parcialmente nublado", "⛅"], 3: ["Nublado", "☁️"],
  45: ["Niebla", "🌫️"], 48: ["Niebla con escarcha", "🌫️"],
  51: ["Llovizna ligera", "🌦️"], 53: ["Llovizna", "🌦️"], 55: ["Llovizna intensa", "🌧️"], 56: ["Llovizna helada", "🌧️"], 57: ["Llovizna helada intensa", "🌧️"],
  61: ["Lluvia ligera", "🌧️"], 63: ["Lluvia", "🌧️"], 65: ["Lluvia fuerte", "🌧️"], 66: ["Lluvia helada", "🌧️"], 67: ["Lluvia helada fuerte", "🌧️"],
  71: ["Nieve ligera", "🌨️"], 73: ["Nieve", "🌨️"], 75: ["Nieve fuerte", "❄️"], 77: ["Granos de nieve", "❄️"],
  80: ["Chubascos ligeros", "🌦️"], 81: ["Chubascos", "🌧️"], 82: ["Chubascos violentos", "⛈️"], 85: ["Chubascos de nieve", "🌨️"], 86: ["Chubascos de nieve fuertes", "🌨️"],
  95: ["Tormenta", "⛈️"], 96: ["Tormenta con granizo", "⛈️"], 99: ["Tormenta con granizo fuerte", "⛈️"],
};

export function describeWeather(code: number | null): { text: string; icon: string } {
  const hit = code === null ? undefined : WMO[code];
  return hit ? { text: hit[0], icon: hit[1] } : { text: "Desconocido", icon: "❔" };
}

export function cleanCity(raw: string | null): string {
  const city = (raw ?? "").trim().slice(0, 80);
  if (city.length < 2) throw new AppError(400, "Falta el parámetro «city» con el nombre de la ciudad (mínimo 2 letras).");
  return city;
}

/** Clima actual y pronóstico de 3 días con Open-Meteo (sin clave; atribución CC BY 4.0). */
export async function getWeather(f: Fetcher, cityRaw: string | null, lang = "es") {
  const city = cleanCity(cityRaw);
  const language = /^[a-z]{2}$/.test(lang) ? lang : "es";
  const geo = obj(await getJson(f, `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${language}&format=json`));
  const place = obj(arr(geo.results)[0]);
  const lat = num(place.latitude);
  const lon = num(place.longitude);
  if (lat === null || lon === null) throw new AppError(404, `No se encontró la ciudad «${city}».`);

  const fc = obj(
    await getJson(
      f,
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`,
    ),
  );
  const cur = obj(fc.current);
  const now = describeWeather(num(cur.weather_code));
  const daily = obj(fc.daily);
  const dates = arr(daily.time);
  return {
    place: { name: str(place.name) ?? city, region: str(place.admin1), country: str(place.country), latitude: lat, longitude: lon, timezone: str(fc.timezone) },
    current: {
      temperatureC: num(cur.temperature_2m),
      feelsLikeC: num(cur.apparent_temperature),
      humidityPct: num(cur.relative_humidity_2m),
      windKmh: num(cur.wind_speed_10m),
      isDay: cur.is_day === 1,
      description: now.text,
      icon: now.icon,
    },
    forecast: dates.map((date, i) => {
      const d = describeWeather(num(arr(daily.weather_code)[i]));
      return {
        date: str(date),
        description: d.text,
        icon: d.icon,
        maxC: num(arr(daily.temperature_2m_max)[i]),
        minC: num(arr(daily.temperature_2m_min)[i]),
        rainChancePct: num(arr(daily.precipitation_probability_max)[i]),
      };
    }),
    attribution: "Datos meteorológicos de Open-Meteo.com (CC BY 4.0)",
  };
}

/* ----------------------------- Tipo de cambio ----------------------------- */

export function cleanCurrency(raw: string | null, name: string): string {
  const code = (raw ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new AppError(400, `El parámetro «${name}» debe ser un código de moneda de 3 letras (por ejemplo USD o PEN).`);
  return code;
}

export function cleanAmount(raw: string | null): number {
  if (raw === null || raw.trim() === "") return 1;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new AppError(400, "El parámetro «amount» debe ser un número positivo.");
  return n;
}

/** Conversión de monedas con ExchangeRate-API (tasas abiertas, se actualizan una vez al día). */
export async function convertCurrency(f: Fetcher, fromRaw: string | null, toRaw: string | null, amountRaw: string | null) {
  const from = cleanCurrency(fromRaw ?? "USD", "from");
  const to = cleanCurrency(toRaw, "to");
  const amount = cleanAmount(amountRaw);
  const data = obj(await getJson(f, `https://open.er-api.com/v6/latest/${from}`));
  if (data.result === "error") throw new AppError(404, `No se reconoce la moneda «${from}».`);
  const rate = num(obj(data.rates)[to]);
  if (data.result !== "success" || rate === null) throw new AppError(404, `No hay tasa de cambio para ${from} → ${to}.`);
  return {
    from,
    to,
    amount,
    rate,
    result: Number((amount * rate).toFixed(4)),
    updatedAt: str(data.time_last_update_utc),
    attribution: "Tasas de ExchangeRate-API.com (https://www.exchangerate-api.com)",
    note: "Tasa de referencia del mercado, no el precio de compra o venta de una casa de cambio.",
  };
}

/* -------------------------------- Traductor -------------------------------- */

const LANG = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
export const MAX_TRANSLATE = 500;

/** Traducción con MyMemory (API gratuita con límite diario por IP; calidad automática, revisa lo importante). */
export async function translateText(f: Fetcher, textRaw: string | null, toRaw: string | null, fromRaw: string | null) {
  const text = (textRaw ?? "").trim();
  if (!text) throw new AppError(400, "Falta el parámetro «text».");
  if (text.length > MAX_TRANSLATE) throw new AppError(400, `El texto es demasiado largo (máximo ${MAX_TRANSLATE} caracteres).`);
  const to = (toRaw ?? "").trim();
  if (!LANG.test(to)) throw new AppError(400, "El parámetro «to» debe ser un código de idioma (por ejemplo en, es, pt, fr).");
  const rawFrom = (fromRaw ?? "").trim();
  const from = !rawFrom || rawFrom.toLowerCase() === "auto" ? "Autodetect" : rawFrom;
  if (from !== "Autodetect" && !LANG.test(from)) throw new AppError(400, "El parámetro «from» debe ser «auto» o un código de idioma.");

  const data = obj(await getJson(f, `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${from}|${to}`)}`));
  const status = Number(data.responseStatus);
  if (status === 429) throw new AppError(503, "El traductor alcanzó su límite diario gratuito. Inténtalo más tarde.");
  const out = str(obj(data.responseData).translatedText);
  if (status !== 200 || !out) throw new AppError(502, "El traductor no pudo procesar este texto.");
  if (/^(INVALID|PLEASE SELECT)/i.test(out)) throw new AppError(400, "Idiomas no válidos para la traducción.");
  return {
    from: from === "Autodetect" ? "auto" : from,
    to,
    text,
    translation: out,
    detectedLanguage: str(obj(data.responseData).detectedLanguage),
    attribution: "Traducción por MyMemory (https://mymemory.translated.net)",
  };
}
