"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { ConfigNotice } from "@/components/Guards";
import { useAuth } from "@/components/Providers";
import { auth } from "@/lib/firebase";
import { authErrorMessage, safeNext, validateEmail } from "@/lib/validators";

function LoginForm() {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  if (!configured) return <ConfigNotice />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);
    if (!password) return setError("Escribe tu contraseña.");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth(), email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError(authErrorMessage((err as { code?: string }).code ?? ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-bold">Iniciar sesión</h1>
      <p className="mt-2 text-muted">Entra para guardar proyectos y publicar tus paquetes.</p>
      <form onSubmit={submit} className="card mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="label">
            Correo electrónico
          </label>
          <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <div className="flex justify-between text-sm">
          <Link href="/reset" className="text-brand hover:underline">
            Olvidé mi contraseña
          </Link>
          <Link href="/register" className="text-brand hover:underline">
            Crear cuenta
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
