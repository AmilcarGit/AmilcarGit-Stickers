import Link from "next/link";
import { Wordmark } from "./Mascot";

export function Footer() {
  return (
    <footer className="yui-footer">
      <div className="yui-footer-inner">
        <div>
          <p className="font-semibold text-ink"><Wordmark /> <span className="font-normal text-muted">· Developer API Platform</span></p>
          <p className="mt-1 text-xs">Herramientas y endpoints para bots y aplicaciones.</p>
        </div>
        <nav aria-label="Enlaces del pie" className="yui-footer-links">
          <Link href="/endpoints">Endpoints</Link>
          <Link href="/developer">Developer Studio</Link>
          <Link href="/docs">Documentación</Link>
          <Link href="/legal">Términos</Link>
        </nav>
      </div>
    </footer>
  );
}
