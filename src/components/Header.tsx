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
  { href: "/developer", label: "Developer Studio" },
  { href: "/docs", label: "Documentación" },
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

  const active = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <header className="yui-topbar">
      <div className="yui-topbar-inner">
        <Link href="/" className="yui-brand" aria-label="YuiAPI, inicio">
          <span className="yui-brand-mark"><Mascot size={34} /></span>
          <span className="hidden min-[390px]:inline-flex"><Wordmark /></span>
        </Link>

        <nav className="yui-nav ml-2 hidden lg:flex" aria-label="Principal">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="yui-nav-link" aria-current={active(link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
          {admin && (
            <>
              <Link href="/admin" className="yui-nav-link" aria-current={active("/admin") ? "page" : undefined}>Administración</Link>
              <Link href="/admin/security" className="yui-nav-link" aria-current={active("/admin/security") ? "page" : undefined}>Seguridad</Link>
            </>
          )}
        </nav>

        <div className="yui-header-actions">
          <span className="hidden xl:inline-flex"><InstallButton /></span>
          <ThemeToggle />
          {!loading && !user && (
            <>
              <Link href="/login" className="btn-ghost hidden !min-h-[40px] sm:inline-flex">Entrar</Link>
              <Link href="/register" className="btn-primary !min-h-[40px]">Crear cuenta</Link>
            </>
          )}
          {user && (
            <>
              <Link href="/settings" className="hidden items-center gap-2 sm:flex" aria-label="Mi cuenta">
                <Avatar username={user.username} name={user.displayName} v={user.avatarV} size={34} />
              </Link>
              <button type="button" onClick={logout} className="btn-ghost hidden !min-h-[40px] sm:inline-flex">Salir</button>
            </>
          )}
          <button type="button" className="btn-ghost !min-h-[40px] !px-3 lg:hidden" aria-expanded={open} aria-controls="yui-mobile-menu" aria-label={open ? "Cerrar menú" : "Abrir menú"} onClick={() => setOpen((value) => !value)}>
            <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="yui-mobile-menu" className="yui-mobile-menu lg:hidden" aria-label="Menú móvil">
          <div className="mx-auto grid max-w-6xl gap-1 sm:grid-cols-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} aria-current={active(link.href) ? "page" : undefined}>{link.label}</Link>
            ))}
            {admin && (
              <>
                <Link href="/admin" aria-current={active("/admin") ? "page" : undefined}>Administración</Link>
                <Link href="/admin/security" aria-current={active("/admin/security") ? "page" : undefined}>Centro de seguridad</Link>
              </>
            )}
            {user ? (
              <button type="button" onClick={logout} className="rounded-lg px-3 py-3 text-left text-sm font-semibold text-danger hover:bg-danger/10">Cerrar sesión</button>
            ) : (
              <Link href="/login">Iniciar sesión</Link>
            )}
            <span className="sm:hidden"><InstallButton /></span>
          </div>
        </nav>
      )}
    </header>
  );
}
