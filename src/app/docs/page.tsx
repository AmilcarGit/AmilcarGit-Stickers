import type { Metadata } from "next";
import Link from "next/link";
import { ENDPOINTS, GROUPS, buildUrl } from "@/lib/endpoints";

export const metadata: Metadata = {
  title: "Documentación",
  description: "Cómo usar YuiApi: autenticación, límites y todos los endpoints de búsqueda, stickers y herramientas.",
};

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

const code = "overflow-x-auto rounded-xl bg-surface2 p-4 text-sm";

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold">Documentación de YuiApi</h1>
        <p className="mt-2 text-muted">
          Convierte imágenes en stickers de WhatsApp, busca música, anime, Wikipedia, libros e imágenes libres y usa herramientas como QR y hashes. Todas las respuestas son JSON con la forma{" "}
          <code>{"{ ok: true, ... }"}</code> o <code>{"{ ok: false, error }"}</code>.
        </p>
        <p className="mt-3">
          <Link href="/dashboard" className="btn-primary inline-flex">
            Obtener mi clave</Link>
          <Link href="/endpoints" className="btn-ghost ml-2 inline-flex">Probar endpoints
          </Link>
        </p>
      </header>

      <section aria-labelledby="auth" className="space-y-3">
        <h2 id="auth" className="text-2xl font-bold">
          Autenticación
        </h2>
        <p>
          Crea una clave en el <Link href="/dashboard" className="text-brand underline">panel</Link> y envíala en el encabezado <code>x-api-key</code> (también sirve{" "}
          <code>Authorization: Bearer …</code>). Evita ponerla en la URL: las direcciones quedan en registros.
        </p>
        <pre className={code}>{`curl -H "x-api-key: TU_CLAVE" "${BASE}/api/v1/me"`}</pre>
      </section>

      <section aria-labelledby="limites" className="space-y-3">
        <h2 id="limites" className="text-2xl font-bold">
          Límites
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="p-2">Plan</th>
                <th scope="col" className="p-2">Solicitudes al día</th>
                <th scope="col" className="p-2">Por minuto</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/50"><td className="p-2">Free</td><td className="p-2">100</td><td className="p-2">30</td></tr>
              <tr className="border-b border-line/50"><td className="p-2">Pro</td><td className="p-2">2 000</td><td className="p-2">120</td></tr>
              <tr><td className="p-2">Ultra</td><td className="p-2">10 000</td><td className="p-2">300</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          El día se reinicia a las 12 a. m. (hora de Lima). Cada respuesta trae <code>x-ratelimit-limit</code>, <code>x-ratelimit-remaining</code> y <code>x-ratelimit-reset</code>. Al excederlos recibes{" "}
          <code>429</code>. Errores comunes: <code>401</code> clave inválida, <code>400</code> parámetro faltante, <code>413</code> archivo muy grande, <code>503</code> servicio externo no disponible.
        </p>
      </section>

      <section aria-labelledby="bot" className="space-y-3">
        <h2 id="bot" className="text-2xl font-bold">
          Ejemplo: sticker desde un bot de WhatsApp
        </h2>
        <p className="text-sm text-muted">
          Con Baileys (u otra librería que envíe stickers). Ejemplo ilustrativo: no está probado con WhatsApp real.
        </p>
        <pre className={code}>{`// Node 18+
const res = await fetch("${BASE}/api/v1/sticker", {
  method: "POST",
  headers: { "x-api-key": process.env.STICKERS_KEY, "content-type": "application/octet-stream" },
  body: imageBuffer, // la foto que mandó la persona
});
if (!res.ok) throw new Error((await res.json()).error);
const webp = Buffer.from(await res.arrayBuffer());
await sock.sendMessage(jid, { sticker: webp });`}</pre>
        <pre className={code}>{`# Con curl
curl -X POST -H "x-api-key: TU_CLAVE" --data-binary @foto.jpg \\
  "${BASE}/api/v1/sticker" -o sticker.webp`}</pre>
      </section>

      {GROUPS.map((g) => (
        <section key={g} aria-label={g} className="space-y-3">
          <h2 className="text-2xl font-bold">{g}</h2>
          <ul className="space-y-3">
            {ENDPOINTS.filter((e) => e.group === g).map((e) => (
              <li key={e.id} className="card !p-4">
                <p className="break-all">
                  <span className="chip !min-h-[28px] mr-2 text-xs font-bold">{e.method}</span>
                  <code>{e.path}</code>
                </p>
                <p className="mt-2 text-sm">{e.what}</p>
                {(e.params.length > 0 || e.body) && (
                  <p className="mt-1 break-words text-xs text-muted">
                    {e.body && "Cuerpo: la imagen (o multipart «file»). "}
                    {e.params.map((p) => `?${p.name}= (${p.label})`).join("  ")}
                  </p>
                )}
                <pre className="mt-2 overflow-x-auto rounded-lg bg-surface2 p-2 text-xs">{`${e.method === "POST" ? "POST " : ""}${buildUrl(e, Object.fromEntries(e.params.map((p) => [p.name, p.example])))}`}</pre>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section aria-labelledby="legal" className="space-y-3">
        <h2 id="legal" className="text-2xl font-bold">
          Uso responsable
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Esta API no descarga contenido de YouTube, Spotify, Apple Music, TikTok ni similares: sus términos y los derechos de autor lo impiden.</li>
          <li>Los stickers de Giphy requieren mostrar «Powered by GIPHY». Las imágenes de Openverse traen autor y licencia: respétalos.</li>
          <li>Los datos de búsqueda vienen de servicios de terceros y pueden fallar o cambiar sin aviso.</li>
        </ul>
      </section>
    </div>
  );
}
