"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InstallButton } from "./InstallButton";
import { Avatar } from "./Avatar";
import { Mascot, Wordmark } from "./Mascot";
import { useAuth, useToast } from "./Providers";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/endpoints", label: "Endpoints" },
  { href: "/docs", label: "Docs" },
  { href: "/ranking", label: "Ranking" },
  { href: "/dashboard", label: "Mi panel" },
  { href: "/settings", label: "Mi perfil" },
];

export function Header() {
  const { user, admin, loading, logout: doLogout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    try {
      await doLogout();
      router.push("/");
    } catch {
      toast("No se pudo cerrar la sesión.", "error");
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 text-xl" aria-label="YuiApi, inicio">
          <Mascot size={36} />
          <Wordmark />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Principal">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface2 ${pathname.startsWith(l.href) ? "text-accent" : "text-ink"}`}
            >
              {l.label}
            </Link>
          ))}
          {admin && (
            <Link href="/admin" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface2">
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <InstallButton />
          <ThemeToggle />
          {!loading && !user && (
            <>
              <Link href="/login" className="btn-ghost !min-h-[40px] hidden sm:inline-flex">
                Entrar
              </Link>
              <Link href="/register" className="btn-primary !min-h-[40px]">
                Crear cuenta
              </Link>
            </>
          )}
          {user && (
            <>
              <Link href="/settings" className="hidden items-center gap-2 sm:flex" aria-label="Mi cuenta">
                <Avatar username={user.username} name={user.displayName} v={user.avatarV} size={36} />
              </Link>
              <button type="button" onClick={logout} className="btn-ghost !min-h-[40px] hidden sm:inline-flex">
                Salir
              </button>
            </>
          )}
          <button
            type="button"
            className="btn-ghost !min-h-[40px] !px-3 md:hidden"
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label="Abrir menú"
            onClick={() => setOpen((o) => !o)}
          >
            <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="menu-movil" className="border-t border-line bg-bg px-4 py-3 md:hidden" aria-label="Menú móvil">
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg px-3 py-3 font-medium hover:bg-surface2">
                  {l.label}
                </Link>
              </li>
            ))}
            {admin && (
              <li>
                <Link href="/admin" className="block rounded-lg px-3 py-3 font-medium hover:bg-surface2">
                  Admin
                </Link>
              </li>
            )}
            {user ? (
              <li>
                <button type="button" onClick={logout} className="block w-full rounded-lg px-3 py-3 text-left font-medium hover:bg-surface2">
                  Cerrar sesión
                </button>
              </li>
            ) : (
              <li>
                <Link href="/login" className="block rounded-lg px-3 py-3 font-medium hover:bg-surface2">
                  Iniciar sesión
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
