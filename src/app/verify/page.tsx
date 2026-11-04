"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { verifyEmailToken } from "@/lib/data";

function VerifyView() {
  const token = useSearchParams().get("token") ?? "";
  const { refresh } = useAuth();
  const [state, setState] = useState<"working" | "ok" | { error: string }>("working");

  useEffect(() => {
    if (!token) {
      setState({ error: "El enlace está incompleto." });
      return;
    }
    let cancelled = false;
    verifyEmailToken(token)
      .then(async () => {
        await refresh();
        if (!cancelled) setState("ok");
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ error: err instanceof Error ? err.message : "No se pudo verificar el correo." });
      });
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  return (
    <div className="card mx-auto max-w-md" role="status">
      {state === "working" && <p>Verificando tu correo…</p>}
      {state === "ok" && (
        <>
          <h1 className="text-2xl font-bold">¡Correo verificado!</h1>
          <p className="mt-2 text-muted">Ya puedes publicar tus paquetes.</p>
          <Link href="/dashboard" className="btn-primary mt-4 inline-flex">
            Ir a mi panel
          </Link>
        </>
      )}
      {typeof state === "object" && (
        <>
          <h1 className="text-2xl font-bold">No se pudo verificar</h1>
          <p className="mt-2 text-danger" role="alert">
            {state.error}
          </p>
          <Link href="/dashboard" className="btn-ghost mt-4 inline-flex">
            Ir a mi panel
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyView />
    </Suspense>
  );
}
