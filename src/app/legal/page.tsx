import type { Metadata } from "next";
import { LICENSES, METADATA_DISCLAIMER } from "@/lib/credits";

export const metadata: Metadata = {
  title: "Derechos de autor y licencias",
  description: "Cómo funcionan los créditos, las licencias y los reportes de contenido en AmilcarGit Stickers.",
};

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold">Derechos de autor, créditos y licencias</h1>
        <p className="mt-2 text-muted">Resumen claro de cómo tratamos la autoría en AmilcarGit Stickers.</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Tú eres responsable de lo que subes</h2>
        <p>
          Al publicar un paquete confirmas que el contenido es tuyo o que tienes permiso para usarlo. En cada paquete declaras si es{" "}
          <strong>original</strong> o <strong>incluye recursos de terceros</strong>, y puedes indicar cuáles.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Créditos de autoría</h2>
        <p>Cada paquete tiene una ficha de autoría con este formato, que también va dentro del ZIP que se descarga (archivo CREDITOS.txt):</p>
        <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-4 text-sm">
{`CREADOR: Nombre del creador
WEB: AmilcarGit-Stickers
AUTORÍA: Creado con AmilcarGit-Stickers
FECHA: 2026-11-03`}
        </pre>
        <p>
          Los créditos <strong>no se dibujan dentro del sticker</strong>: viajan en la ficha, en el paquete y en los datos del proyecto, para que tu diseño
          quede limpio.
        </p>
        <p className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">{METADATA_DISCLAIMER}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Licencias disponibles</h2>
        <ul className="space-y-2">
          {Object.values(LICENSES).map((l) => (
            <li key={l.label} className="card !p-4">
              <strong>{l.label}</strong>
              <p className="text-sm text-muted">{l.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Reportar contenido</h2>
        <p>
          Si crees que un paquete infringe tus derechos o incumple las normas, usa el botón <strong>Reportar</strong> en la página del paquete. Un
          moderador revisa cada reporte y, si corresponde, retira el paquete de la plataforma.
        </p>
      </section>
    </article>
  );
}
