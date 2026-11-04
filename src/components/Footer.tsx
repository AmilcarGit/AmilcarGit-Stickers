import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span aria-hidden="true">👑</span> AmilcarGit Stickers · Hecho para crear stickers de WhatsApp.
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-4">
          <Link href="/legal" className="hover:text-ink">
            Derechos de autor y licencias
          </Link>
          <Link href="/explore" className="hover:text-ink">
            Explorar
          </Link>
        </nav>
      </div>
    </footer>
  );
}
