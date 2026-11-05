import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentación de la API",
  description: "API para crear stickers de WhatsApp, buscar y descargar paquetes, y consultar música, anime, Wikipedia, libros e imágenes libres.",
};

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

type Endpoint = { method: "GET" | "POST"; path: string; what: string; params: string };

const ENDPOINTS: { group: string; items: Endpoint[] }[] = [
  {
    group: "Stickers",
    items: [
      { method: "POST", path: "/api/v1/sticker", what: "Convierte una imagen o GIF en un sticker de WhatsApp (WebP 512×512, transparente, dentro del peso permitido).", params: "Cuerpo: la imagen (o multipart «file»). ?fit=contain|cover  ?quality=10-100  ?format=json" },
      { method: "GET", path: "/api/v1/sticker/search", what: "Busca stickers en Giphy.", params: "?q=  ?limit=" },
      { method: "GET", path: "/api/v1/packs", what: "Paquetes públicos de la comunidad.", params: "?q=  ?category=  ?limit=  ?offset=" },
      { method: "GET", path: "/api/v1/packs/{id}", what: "Un paquete con las direcciones de sus stickers.", params: "—" },
      { method: "GET", path: "/api/v1/download/pack/{id}", what: "Descarga el paquete como ZIP o archivo .wastickers.", params: "?format=zip|wastickers" },
    ],
  },
  {
    group: "Búsqueda",
    items: [
      { method: "GET", path: "/api/v1/search/music", what: "Canciones (Apple iTunes Search). Incluye un fragmento oficial de 30 s, no la canción completa.", params: "?q=  ?limit=" },
      { method: "GET", path: "/api/v1/search/anime", what: "Anime (Jikan / MyAnimeList).", params: "?q=  ?limit=" },
      { method: "GET", path: "/api/v1/search/wiki", what: "Artículos de Wikipedia.", params: "?q=  ?lang=es  ?limit=" },
      { method: "GET", path: "/api/v1/search/books", what: "Libros (Open Library).", params: "?q=  ?limit=" },
      { method: "GET", path: "/api/v1/search/images", what: "Imágenes con licencia abierta (Openverse), con autor y licencia.", params: "?q=  ?limit=" },
    ],
  },
  {
    group: "Herramientas",
    items: [
      { method: "GET", path: "/api/v1/tools/qr", what: "Código QR en PNG.", params: "?text=  ?size=128-1024" },
      { method: "GET", path: "/api/v1/tools/hash", what: "Hash de un texto.", params: "?text=  ?algo=md5|sha1|sha256|sha512" },
      { method: "GET", path: "/api/v1/tools/uuid", what: "UUID v4.", params: "?count=1-50" },
      { method: "GET", path: "/api/v1/tools/base64", what: "Codifica o decodifica Base64.", params: "?text=  ?mode=encode|decode" },
      { method: "GET", path: "/api/v1/tools/password", what: "Contraseña aleatoria segura.", params: "?length=8-64  ?symbols=true|false" },
      { method: "GET", path: "/api/v1/me", what: "Tu plan y las solicitudes que te quedan hoy.", params: "—" },
    ],
  },
];

const code = "overflow-x-auto rounded-xl bg-surface2 p-4 text-sm";

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold">API de AmilcarGit Stickers</h1>
        <p className="mt-2 text-muted">
          Crea stickers de WhatsApp desde tu bot, busca y descarga paquetes y consulta música, anime, Wikipedia, libros e imágenes libres. Todas las respuestas son JSON con la forma{" "}
          <code>{"{ ok: true, ... }"}</code> o <code>{"{ ok: false, error }"}</code>.
        </p>
        <p className="mt-3">
          <Link href="/developers" className="btn-primary inline-flex">
            Obtener mi clave
          </Link>
        </p>
      </header>

      <section aria-labelledby="auth" className="space-y-3">
        <h2 id="auth" className="text-2xl font-bold">
          Autenticación
        </h2>
        <p>
          Crea una clave en el <Link href="/developers" className="text-brand underline">panel de desarrollador</Link> y envíala en el encabezado <code>x-api-key</code> (también sirve{" "}
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

      {ENDPOINTS.map((g) => (
        <section key={g.group} aria-label={g.group} className="space-y-3">
          <h2 className="text-2xl font-bold">{g.group}</h2>
          <ul className="space-y-3">
            {g.items.map((e) => (
              <li key={e.path} className="card !p-4">
                <p className="break-all">
                  <span className="chip !min-h-[28px] mr-2 text-xs font-bold">{e.method}</span>
                  <code>{e.path}</code>
                </p>
                <p className="mt-2 text-sm">{e.what}</p>
                {e.params !== "—" && <p className="mt-1 break-words text-xs text-muted">{e.params}</p>}
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
          <li>Los paquetes de la comunidad pertenecen a sus autores; cada uno trae su licencia y ficha de autoría.</li>
          <li>Los datos de búsqueda vienen de servicios de terceros y pueden fallar o cambiar sin aviso.</li>
        </ul>
      </section>
    </div>
  );
}
