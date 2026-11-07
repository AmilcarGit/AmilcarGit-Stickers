import Link from "next/link";
import { Mascot } from "@/components/Mascot";

const features = [
  { icon: "🔎", title: "Búsqueda abierta", text: "Música (fragmentos oficiales), anime, Wikipedia, libros e imágenes con licencia libre, todo con el mismo formato JSON." },
  { icon: "🖼️", title: "Stickers para WhatsApp", text: "Convierte cualquier imagen o GIF en un WebP 512×512 transparente, dentro del peso permitido, listo para tu bot." },
  { icon: "🧰", title: "Herramientas", text: "Códigos QR, hashes, UUID, Base64 y contraseñas seguras con una sola llamada." },
  { icon: "🔑", title: "Claves y planes", text: "Crea hasta 5 claves gratis, mira tu uso diario y sube de plan cuando lo necesites. Las claves se guardan solo como hash." },
  { icon: "⚡", title: "Límites claros", text: "Cada respuesta trae sus cabeceras x-ratelimit-*: sabes cuánto te queda sin adivinar." },
  { icon: "⚖️", title: "Contenido legal", text: "Sin descargadores de YouTube/Spotify/TikTok: solo fuentes abiertas, con autor y licencia a la vista." },
];

const steps = [
  { n: "1", title: "Crea tu cuenta", text: "Regístrate y verifica tu correo." },
  { n: "2", title: "Genera una clave", text: "Desde tu panel, con el nombre de tu bot o app." },
  { n: "3", title: "Llama a la API", text: "Envía la clave en x-api-key y recibe JSON o imágenes." },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 py-6 md:grid-cols-2">
        <div>
          <p className="mb-3 inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            🌸 API pública · clave gratuita
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Tu API de <span className="text-brand">búsqueda</span>, <span className="text-accent">stickers</span> y herramientas
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            YuiApi reúne en un solo lugar lo que tu bot o tu app suele necesitar: resultados de fuentes abiertas y utilidades listas para usar.
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

      <section aria-labelledby="ejemplo" className="card space-y-3">
        <h2 id="ejemplo" className="text-xl font-bold">
          Así de simple
        </h2>
        <pre className="overflow-x-auto rounded-xl bg-surface2 p-4 text-sm">{`curl -H "x-api-key: TU_CLAVE" \\
  "https://yuiapi.vercel.app/api/v1/search/anime?q=naruto&limit=3"`}</pre>
      </section>

      <section aria-labelledby="funciones">
        <h2 id="funciones" className="mb-8 text-2xl font-bold sm:text-3xl">
          Qué incluye
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="card">
              <div className="mb-3 text-3xl" aria-hidden="true">
                {f.icon}
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

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
