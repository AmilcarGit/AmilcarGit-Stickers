"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ConfigNotice } from "@/components/Guards";
import { useAuth, useToast } from "@/components/Providers";
import { registerUser, usernameAvailable } from "@/lib/data";
import { authErrorMessage, normalizeUsername, validateEmail, validatePassword, validateUsername } from "@/lib/validators";

export default function RegisterPage() {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "", confirm: "", username: "", displayName: "", accept: false });
  const [error, setError] = useState("");
  const [usernameState, setUsernameState] = useState<"" | "ok" | "taken" | "invalid">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && !busy) router.replace("/dashboard");
  }, [loading, user, busy, router]);

  if (!configured) return <ConfigNotice />;

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function checkUsername() {
    if (!form.username) return setUsernameState("");
    if (validateUsername(form.username)) return setUsernameState("invalid");
    try {
      setUsernameState((await usernameAvailable(form.username)) ? "ok" : "taken");
    } catch {
      setUsernameState("");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problem =
      validateEmail(form.email) ||
      validateUsername(form.username) ||
      validatePassword(form.password) ||
      (form.password !== form.confirm ? "Las contraseñas no coinciden." : null) ||
      (!form.accept ? "Debes aceptar la política de derechos de autor." : null);
    if (problem) return setError(problem);

    setBusy(true);
    try {
      await registerUser({
        email: form.email,
        password: form.password,
        username: form.username,
        displayName: form.displayName.slice(0, 60),
      });
      toast("Cuenta creada. Te enviamos un correo para verificarla.", "ok");
      router.replace("/dashboard");
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code ? authErrorMessage(code) : err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-bold">Crear cuenta</h1>
      <p className="mt-2 text-muted">Gratis. Verificarás tu correo para poder publicar.</p>
      <form onSubmit={submit} className="card mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="displayName" className="label">
            Nombre del creador
          </label>
          <input id="displayName" className="input" maxLength={60} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Cómo quieres que te llamen" />
          <p className="hint">Aparece en los créditos de tus stickers.</p>
        </div>
        <div>
          <label htmlFor="username" className="label">
            Nombre de usuario
          </label>
          <input
            id="username"
            className="input"
            autoCapitalize="none"
            autoComplete="username"
            value={form.username}
            onChange={(e) => {
              set("username", normalizeUsername(e.target.value));
              setUsernameState("");
            }}
            onBlur={checkUsername}
            aria-describedby="username-hint"
          />
          <p id="username-hint" className={`hint ${usernameState === "ok" ? "!text-ok" : usernameState ? "!text-danger" : ""}`}>
            {usernameState === "ok"
              ? "¡Disponible!"
              : usernameState === "taken"
                ? "Ese usuario ya existe."
                : usernameState === "invalid"
                  ? "De 3 a 20 caracteres: minúsculas, números o _."
                  : "Tu enlace público será /u/tu-usuario"}
          </p>
        </div>
        <div>
          <label htmlFor="email" className="label">
            Correo electrónico
          </label>
          <input id="email" type="email" autoComplete="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <input id="password" type="password" autoComplete="new-password" className="input" value={form.password} onChange={(e) => set("password", e.target.value)} />
          <p className="hint">Mínimo 8 caracteres, con letras y al menos un número.</p>
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            Repite la contraseña
          </label>
          <input id="confirm" type="password" autoComplete="new-password" className="input" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[rgb(var(--brand))]" checked={form.accept} onChange={(e) => set("accept", e.target.checked)} />
          <span>
            Confirmo que subiré contenido propio o con permiso, y acepto la{" "}
            <Link href="/legal" className="text-brand underline" target="_blank">
              política de derechos de autor
            </Link>
            .
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Creando cuenta…" : "Crear cuenta"}
        </button>
        <p className="text-center text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
