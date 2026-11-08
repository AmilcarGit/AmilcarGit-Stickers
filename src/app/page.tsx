import type { CSSProperties } from "react";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { TopRanking } from "@/components/TopRanking";
import { ENDPOINTS, GROUPS } from "@/lib/endpoints";

const groupInfo: Record<(typeof GROUPS)[number], { icon: string; text: string }> = {
  Stickers: { icon: "🖼️", text: "Convierte imágenes y GIF, crea stickers de texto y quita fondos lisos." },
  Utilidades: { icon: "🧭", text: "Clima, tipo de cambio y traductor listos para un comando de bot." },
  Búsqueda: { icon: "🔎", text: "Música, anime, Wikipedia, libros, series, países, papers y más." },
  "Descargas y archivos": { icon: "📦", text: "Datos de archivos, Base64 y descargas." },
  Imágenes: { icon: "🎨", text: "Redimensiona, comprime, convierte y desenfoca." },
  Generadores: { icon: "✨", text: "QR, hashes, UUID y contraseñas seguras." },
  Desarrolladores: { icon: "🛠️", text: "JSON, URL y Base64 a una llamada de distancia." },
  Cuenta: { icon: "🔑", text: "Consulta tu plan y lo que te queda hoy." },
};

const botIdeas = [
  { cmd: "/clima lima", path: "/api/v1/weather?city=Lima", what: "Clima y pronóstico de 3 días" },
  { cmd: "/dolar 100", path: "/api/v1/exchange?from=USD&to=PEN&amount=100", what: "Convierte monedas" },
  { cmd: "/traducir en hola", path: "/api/v1/translate?text=hola&to=en", what: "Traduce textos cortos" },
  { cmd: "/attp hola", path: "/api/v1/sticker/text?text=hola", what: "Sticker solo con texto" },
  { cmd: "/s (foto)", path: "/api/v1/sticker", what: "Imagen o GIF a sticker" },
  { cmd: "/sinfondo (foto)", path: "/api/v1/sticker/remove-bg", what: "Quita fondos lisos" },
];

const steps = [
  { n: "1", title: "Crea tu cuenta", text: "Regístrate y verifica tu correo." },
  { n: "2", title: "Genera una clave", text: "Desde tu panel, con el nombre de tu bot o app." },
  { n: "3", title: "Llama a la API", text: "Envía la clave en x-api-key y recibe JSON o imágenes." },
];

const petals = [
  { x: "6%", s: "14px", d: "11s", delay: "0s", drift: "40px" },
  { x: "18%", s: "10px", d: "14s", delay: "3s", drift: "-30px" },
  { x: "31%", s: "16px", d: "12s", delay: "6s", drift: "50px" },
  { x: "47%", s: "9px", d: "15s", delay: "1s", drift: "-40px" },
  { x: "62%", s: "13px", d: "10s", delay: "4s", drift: "30px" },
  { x: "75%", s: "11px", d: "13s", delay: "7s", drift: "-50px" },
  { x: "88%", s: "15px", d: "12s", delay: "2s", drift: "-20px" },
];

export default function HomePage() {
  const total = ENDPOINTS.length;
  return (
    <div className="space-y-20">
      <section className="relative grid items-center gap-10 py-6 md:grid-cols-2">
        <div className="petals" aria-hidden="true">
          {petals.map((p) => (
            <span
              key={p.x}
              className="petal"
              style={{ "--x": p.x, "--s": p.s, "--d": p.d, "--delay": p.delay, "--drift": p.drift } as CSSProperties}
            />
          ))}
        </div>

        <div className="relative">
          <p className="mb-3 inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            🌸 {total} endpoints · clave gratuita
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            La API para tu <span className="text-brand">bot de WhatsApp</span> y tus <span className="text-accent">apps</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Stickers, búsqueda, clima, tipo de cambio, traductor y herramientas listas para usar, con respuestas claras y límites visibles en cada llamada.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              Obtener mi clave
            </Link>
            <Link href="/endpoints" className="btn-ghost">
              Probar endpoints
            </Link>
            <Link href="/docs" className="btn-ghost">
              Documentación
            </Link>
          </div>
        </div>

        <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center" aria-hidden="true">
          <div className="absolute inset-4 rounded-[2rem] bg-gradient-to-br from-brand/35 via-transparent to-accent/35 blur-2xl" />
          <div className="card relative flex h-full w-full items-center justify-center !rounded-[2rem]">
            <Mascot size={260} className="drop-shadow-xl" />
          </div>
        </div>
      </section>

      <section aria-labelledby="bots">
        <h2 id="bots" className="text-2xl font-bold sm:text-3xl">
          Pensada para comandos de bot
        </h2>
        <p className="mt-2 max-w-2xl text-muted">Un comando, una llamada. Estos son ejemplos de lo que tu bot puede responder con YuiApi.</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {botIdeas.map((b) => (
            <li key={b.cmd} className="card lift !p-4">
              <p className="font-mono text-sm font-bold text-brand">{b.cmd}</p>
              <p className="mt-1 text-sm">{b.what}</p>
              <p className="mt-2 truncate font-mono text-xs text-muted" title={b.path}>
                {b.path}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ejemplo" className="card space-y-3">
        <h2 id="ejemplo" className="text-xl font-bold">
          Así de simple
        </h2>
        <pre className="overflow-x-auto rounded-xl bg-surface2 p-4 text-sm">{`curl -H "x-api-key: TU_CLAVE" \\
  "https://yuiapi.vercel.app/api/v1/weather?city=Lima"`}</pre>
      </section>

      <section aria-labelledby="funciones">
        <h2 id="funciones" className="mb-8 text-2xl font-bold sm:text-3xl">
          Qué incluye
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GROUPS.map((g) => (
            <Link key={g} href="/endpoints" className="card lift block">
              <div className="mb-3 text-3xl" aria-hidden="true">
                {groupInfo[g].icon}
              </div>
              <h3 className="font-semibold">{g}</h3>
              <p className="mt-1 text-xs text-accent">{ENDPOINTS.filter((e) => e.group === g).length} endpoints</p>
              <p className="mt-2 text-sm text-muted">{groupInfo[g].text}</p>
            </Link>
          ))}
        </div>
      </section>

      <TopRanking />

      <section aria-labelledby="como">
        <h2 id="como" className="mb-8 text-2xl font-bold sm:text-3xl">
          Cómo empezar
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="card">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand text-lg font-bold text-on-brand">{s.n}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Empieza gratis</h2>
          <p className="mt-1 text-sm text-muted">Plan free: 100 solicitudes al día. Sin tarjeta.</p>
        </div>
        <Link href="/register" className="btn-primary">
          Crear cuenta
        </Link>
      </section>
    </div>
  );
}
