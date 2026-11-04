import Link from "next/link";

const features = [
  {
    icon: "🧊",
    title: "Efecto 3D de verdad",
    text: "Profundidad, luz, sombra y borde blanco profesional con un clic. Elige Plano, Caricatura, 3D o Realista y ajusta cada valor.",
  },
  {
    icon: "🎞️",
    title: "Stickers animados",
    text: "Rebote, latido, giro, balanceo y más, en bucle y con vista previa en tiempo real. Se exportan como WebP animado.",
  },
  {
    icon: "📱",
    title: "Hecho para el móvil",
    text: "Editor táctil que funciona en Android, iPhone, tablet y computadora, con modo claro y oscuro.",
  },
  {
    icon: "✅",
    title: "Listo para WhatsApp",
    text: "512×512, fondo transparente, peso máximo y emojis validados con los requisitos oficiales antes de que descargues.",
  },
  {
    icon: "©️",
    title: "Créditos de autoría",
    text: "Cada paquete lleva su ficha: creador, fecha, licencia y si usa recursos de terceros. Con sistema de reportes.",
  },
  {
    icon: "🌐",
    title: "Comunidad",
    text: "Publica tus paquetes, explora los de otros creadores, guarda favoritos y comparte enlaces.",
  },
];

const steps = [
  { n: "1", title: "Crea", text: "Sube una imagen, quítale el fondo, añade texto o emojis y dale estilo 3D." },
  { n: "2", title: "Exporta", text: "Descarga WebP validado o arma un paquete de 3 a 30 stickers en un ZIP." },
  { n: "3", title: "Comparte", text: "Publica tu paquete con tu perfil de creador y comparte el enlace." },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 py-6 md:grid-cols-2">
        <div>
          <p className="mb-3 inline-block rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-medium text-gold">
            Plataforma de stickers para WhatsApp
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Crea stickers <span className="text-brand">3D</span> y <span className="text-gold">animados</span> que se ven de verdad profesionales
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Un estudio completo en tu navegador: recorta, quita fondos, añade volumen y movimiento, y exporta en el formato exacto que pide WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/editor" className="btn-primary">
              Crear mi primer sticker
            </Link>
            <Link href="/explore" className="btn-ghost">
              Explorar paquetes
            </Link>
          </div>
        </div>

        <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center" aria-hidden="true">
          <div className="checker absolute inset-0 rounded-[2rem] border border-line opacity-70" />
          <div className="absolute inset-6 rounded-[1.5rem] bg-gradient-to-br from-brand/40 via-transparent to-gold/30 blur-2xl" />
          <span className="relative animate-bounce text-[9rem] leading-none drop-shadow-2xl">👑</span>
        </div>
      </section>

      <section aria-labelledby="funciones">
        <h2 id="funciones" className="mb-8 text-2xl font-bold sm:text-3xl">
          Todo lo que necesitas para crear
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
          Cómo funciona
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="card">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">{s.n}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Empieza gratis</h2>
          <p className="mt-1 text-sm text-muted">Crea tu cuenta, verifica tu correo y publica tu primer paquete.</p>
        </div>
        <Link href="/register" className="btn-primary">
          Crear cuenta
        </Link>
      </section>
    </div>
  );
}
