"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { resendVerification } from "@/lib/data";
import { useAuth, useToast } from "./Providers";

/** Protege una página: sin sesión redirige a /login y recuerda a dónde volver. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted" role="status">
        Cargando…
      </div>
    );
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();
  return (
    <RequireAuth>
      {loading ? null : admin ? (
        children
      ) : (
        <div className="card mx-auto max-w-xl" role="alert">
          Esta sección es solo para moderadores.
        </div>
      )}
    </RequireAuth>
  );
}

export function VerifyBanner() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!user || user.emailVerified) return null;

  async function resend() {
    setBusy(true);
    try {
      await resendVerification();
      toast("Te enviamos otro correo de verificación.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo enviar el correo. Inténtalo otra vez.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    setBusy(true);
    try {
      await refresh();
      toast("Si ya abriste el enlace del correo, tu cuenta aparecerá verificada en un momento.", "info");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-gold/50 bg-gold/10 p-4 text-sm" role="alert">
      <p className="font-semibold">Verifica tu correo ({user.email})</p>
      <p className="mt-1 text-muted">Necesitas verificarlo para publicar paquetes. Revisa también la carpeta de spam.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={resend} disabled={busy}>
          Reenviar correo
        </button>
        <button type="button" className="btn-primary" onClick={check} disabled={busy}>
          Ya lo verifiqué
        </button>
      </div>
    </div>
  );
}
