import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { TopRanking } from "@/components/TopRanking";
import { ENDPOINTS, GROUPS } from "@/lib/endpoints";

const groupInfo: Record<(typeof GROUPS)[number], { icon: string; text: string }> = {
  Stickers: { icon: "▧", text: "Convierte imágenes y GIF, crea stickers de texto y quita fondos lisos." },
  Utilidades: { icon: "⌁", text: "Clima, tipo de cambio y traductor listos para un comando de bot." },
  Búsqueda: { icon: "⌕", text: "Música, anime, Wikipedia, libros, series, países, papers y más." },
  "Descargas y archivos": { icon: "⇩", text: "Datos de archivos, Base64 y descargas." },
  Imágenes: { icon: "◈", text: "Redimensiona, comprime, convierte y desenfoca." },
  Generadores: { icon: "✳", text: "QR, hashes, UUID y contraseñas seguras." },
  Desarrolladores: { icon: "{ }", text: "JSON, URL y Base64 a una llamada de distancia." },
  Cuenta: { icon: "◎", text: "Consulta tu plan y lo que te queda hoy." },
};

const examples = [
  { command: "/clima lima", path: "/api/v1/weather?city=Lima", description: "Clima y pronóstico" },
  { command: "/dolar 100", path: "/api/v1/exchange?from=USD&to=PEN&amount=100", description: "Conversión de monedas" },
  { command: "/traducir en hola", path: "/api/v1/translate?text=hola&to=en", description: "Traducción de textos" },
];

const steps = [
  { number: "01", title: "Crea tu cuenta", description: "Regístrate y verifica tu correo." },
  { number: "02", title: "Genera una clave", description: "Crea una API Key desde tu panel." },
  { number: "03", title: "Integra y construye", description: "Envía la clave en x-api-key y recibe JSON o archivos." },
];

export default function HomePage() {
  const total = ENDPOINTS.length;
  return (
    <div className="yui-home space-y-5">
      <section className="yui-home-hero">
        <div className="yui-home-copy">
          <span className="yui-home-eyebrow"><span className="yui-live-dot" /> API TOOLKIT · PARA DEVELOPERS</span>
          <h1 className="yui-home-title">Una API. <span>Más posibilidades.</span></h1>
          <p className="yui-home-lead">
            Construye bots y aplicaciones con endpoints para stickers, búsqueda, utilidades y herramientas.
            Una plataforma clara para integrar, probar y administrar tus solicitudes.
          </p>
          <div className="yui-home-actions">
            <Link href="/register" className="btn-primary">Crear cuenta gratuita <span aria-hidden="true">↗</span></Link>
            <Link href="/endpoints" className="btn-ghost">Explorar endpoints</Link>
            <Link href="/docs" className="btn-ghost">Leer documentación</Link>
          </div>
          <div className="yui-home-proof">
            <span><b>●</b> Clave gratuita</span>
            <span><b>●</b> Sin tarjeta</span>
            <span><b>●</b> Diseñada para bots y apps</span>
          </div>
        </div>
        <div className="yui-home-art" aria-label="Yui, mascota de YuiAPI">
          <Mascot size={280} className="yui-home-mascot" title="Yui, mascota de YuiAPI" />
        </div>
      </section>

      <section className="yui-home-stats" aria-label="Resumen de la plataforma">
        <div className="yui-home-stat"><strong>{total}+</strong><span>Endpoints disponibles</span></div>
        <div className="yui-home-stat"><strong>{GROUPS.length}</strong><span>Categorías organizadas</span></div>
        <div className="yui-home-stat"><strong>100 / día</strong><span>Límite del plan gratuito</span></div>
      </section>

      <section className="yui-home-section">
        <div className="yui-home-section-head">
          <div><h2>Todo lo que necesitas para integrar</h2><p>Explora el catálogo por categorías y encuentra el endpoint adecuado para tu siguiente función.</p></div>
          <Link href="/endpoints" className="text-sm font-semibold text-brand hover:underline">Ver catálogo completo ↗</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((group) => (
            <Link key={group} href="/endpoints" className="yui-category-card">
              <span className="yui-category-icon" aria-hidden="true">{groupInfo[group].icon}</span>
              <h3 className="mt-4 font-bold">{group}</h3>
              <p className="mt-1 text-xs font-semibold text-accent">{ENDPOINTS.filter((endpoint) => endpoint.group === group).length} endpoints</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{groupInfo[group].text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="yui-home-section grid items-start gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <div>
          <span className="yui-home-eyebrow">INTEGRACIÓN RÁPIDA</span>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">De la documentación al primer request.</h2>
          <p className="mt-3 text-sm leading-7 text-muted">Prueba una llamada, revisa la respuesta y lleva el ejemplo a tu bot o aplicación.</p>
          <Link href="/developer" className="btn-primary mt-5">Abrir Developer Studio ↗</Link>
        </div>
        <div className="yui-code-panel">
          <div className="yui-code-head"><span>REQUEST · cURL</span><span>GET /api/v1/weather</span></div>
          <pre>{`curl -H "x-api-key: TU_CLAVE" \\\n  "https://yuiapi.vercel.app/api/v1/weather?city=Lima"`}</pre>
        </div>
      </section>

      <section className="yui-home-section">
        <div className="yui-home-section-head"><div><h2>Empieza en tres pasos</h2><p>Una ruta sencilla para pasar de una cuenta nueva a una integración funcional.</p></div></div>
        <ol className="grid gap-3 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.number} className="yui-step">
              <span className="yui-step-num">{step.number}</span>
              <h3 className="mt-4 font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="yui-home-section">
        <div className="yui-home-section-head"><div><h2>Ejemplos para tus bots</h2><p>Rutas ilustrativas que puedes adaptar a los comandos de tus proyectos.</p></div></div>
        <div className="grid gap-3 md:grid-cols-3">
          {examples.map((item) => (
            <article key={item.command} className="card !p-4">
              <p className="font-mono text-sm font-bold text-accent">{item.command}</p>
              <p className="mt-2 text-sm font-semibold">{item.description}</p>
              <code className="mt-3 block break-all text-xs text-muted">{item.path}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="yui-home-section"><TopRanking /></section>

      <section className="card flex flex-col items-start justify-between gap-4 !p-6 sm:flex-row sm:items-center">
        <div><span className="yui-home-eyebrow">LISTO PARA EMPEZAR</span><h2 className="mt-3 text-xl font-extrabold">Construye algo con YuiAPI.</h2><p className="mt-1 text-sm text-muted">Crea tu cuenta y genera tu primera clave API.</p></div>
        <Link href="/register" className="btn-primary">Crear cuenta gratuita ↗</Link>
      </section>
    </div>
  );
}
