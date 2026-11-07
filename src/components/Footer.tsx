import Link from "next/link";
import { Wordmark } from "./Mascot";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span aria-hidden="true">🌸</span> <Wordmark /> · API de búsqueda y herramientas, hecha con cariño.
        </p>
        <nav aria-label="Pie" className="flex flex-wrap gap-4">
          <Link href="/endpoints" className="hover:text-ink">
            Endpoints
          </Link>
          <Link href="/docs" className="hover:text-ink">
            Documentación
          </Link>
          <Link href="/legal" className="hover:text-ink">
            Términos
          </Link>
        </nav>
      </div>
    </footer>
  );
}
