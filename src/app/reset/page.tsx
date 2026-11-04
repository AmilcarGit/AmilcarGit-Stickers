"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { forgotPassword } from "@/lib/data";
import { validateEmail } from "@/lib/validators";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problem = validateEmail(email);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await forgotPassword(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo.");
      setBusy(false);
      return;
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-bold">Recuperar contraseña</h1>
      {sent ? (
        <div className="card mt-6" role="status">
          <p className="font-semibold">Revisa tu correo</p>
          <p className="mt-2 text-sm text-muted">
            Si existe una cuenta con <strong>{email}</strong>, te enviamos un enlace para crear una contraseña nueva. Mira también la carpeta de spam.
          </p>
          <Link href="/login" className="btn-primary mt-4 inline-flex">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="label">
              Correo electrónico
            </label>
            <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Enviando…" : "Enviar enlace"}
          </button>
          <Link href="/login" className="block text-center text-sm text-brand hover:underline">
            Volver
          </Link>
        </form>
      )}
    </div>
  );
}
