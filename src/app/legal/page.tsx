import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y uso responsable",
  description: "Reglas de uso de YuiApi: contenido legal, límites de la API y privacidad.",
};

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold">Términos y uso responsable</h1>
        <p className="mt-2 text-muted">Resumen claro de cómo funciona YuiApi y qué esperamos de quien la usa.</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Qué es YuiApi</h2>
        <p>
          YuiApi es una API pública que reúne búsqueda de contenido abierto (stickers, música de muestra, anime, enciclopedia, libros e imágenes
          libres) y herramientas útiles (QR, hashes, UUID, Base64, contraseñas, convertidor de stickers WebP). Cada resultado indica su proveedor y su
          enlace de origen.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Lo que NO hacemos</h2>
        <p>
          YuiApi <strong>no descarga</strong> videos ni música de plataformas como YouTube, Spotify, Apple Music o TikTok, ni evade protecciones de
          copia. Las vistas previas de música son las que el propio proveedor publica para ese fin. Las imágenes y textos pertenecen a sus autores y
          conservan su licencia: respétala al usarlos.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Tu cuenta y tus claves</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Necesitas un correo verificado para crear claves. Cada persona puede tener hasta 5.</li>
          <li>Las claves se muestran una sola vez y se guardan únicamente como hash. Trátalas como una contraseña.</li>
          <li>Si una clave se filtra, revócala desde el panel y crea otra.</li>
          <li>Podemos suspender cuentas que abusen de la API, intenten saltarse los límites o usen el servicio contra terceros.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Límites</h2>
        <p>
          Cada plan tiene un cupo diario y un límite por minuto, visibles en las cabeceras <code>x-ratelimit-*</code> de cada respuesta. El cupo diario
          se reinicia a medianoche (hora de Lima).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Privacidad</h2>
        <p>
          Guardamos tu correo, tu usuario, la contraseña (solo su hash) y el conteo de uso de tus claves. No vendemos datos. Las consultas que envías a
          proveedores externos (por ejemplo, el texto de una búsqueda) se reenvían a ese proveedor para obtener el resultado.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Sin garantías</h2>
        <p>El servicio se ofrece «tal cual». Los proveedores externos pueden fallar o cambiar sin aviso; en ese caso la API responde con un error claro.</p>
      </section>
    </article>
  );
}
