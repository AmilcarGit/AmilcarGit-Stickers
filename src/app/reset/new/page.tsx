"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useToast } from "@/components/Providers";
import { resetPassword } from "@/lib/data";
import { validatePassword } from "@/lib/validators";

function NewPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problem = validatePassword(password) || (password !== confirm ? "Las contraseñas no coinciden." : null);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await resetPassword(token, password);
      toast("Contraseña actualizada. Inicia sesión con la nueva.", "ok");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="card mx-auto max-w-md" role="alert">
        El enlace está incompleto. <Link href="/reset" className="text-brand underline">Pide uno nuevo</Link>.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-bold">Crea tu contraseña nueva</h1>
      <form onSubmit={submit} className="card mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="label">
            Contraseña nueva
          </label>
          <input id="password" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="hint">Mínimo 8 caracteres, con letras y al menos un número.</p>
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            Repite la contraseña
          </label>
          <input id="confirm" type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense fallback={null}>
      <NewPasswordForm />
    </Suspense>
  );
}
