"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { useAuth, useToast } from "@/components/Providers";
import { saveProfile } from "@/lib/data";

function SettingsInner() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setDisplayName(user.displayName);
  }, [user]);

  if (!user) {
    return (
      <p className="text-muted" role="status">
        Cargando cuenta…
      </p>
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const name = displayName.trim().slice(0, 60) || user.username;
      setUser(await saveProfile({ displayName: name }));
      toast("Cuenta actualizada.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <VerifyBanner />
      <h1 className="text-3xl font-bold">Mi cuenta</h1>

      <form onSubmit={save} className="card space-y-4">
        <div>
          <label htmlFor="name" className="label">
            Nombre visible
          </label>
          <input id="name" className="input" maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      <section className="card space-y-1 text-sm text-muted">
        <p>
          Usuario: <strong className="text-ink">@{user.username}</strong> (no se puede cambiar)
        </p>
        <p>
          Correo: <strong className="text-ink">{user.email}</strong> · {user.emailVerified ? "verificado" : "sin verificar"}
        </p>
        <p>
          Plan de la API: <strong className="text-ink">{user.plan}</strong>
        </p>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsInner />
    </RequireAuth>
  );
}
