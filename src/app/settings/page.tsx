"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { useAuth, useToast } from "@/components/Providers";
import { Avatar } from "@/components/Avatar";
import { deleteAvatar, saveProfile, uploadAvatar } from "@/lib/data";

function SettingsInner() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast("La foto pesa más de 2 MB.", "error");
    setPhotoBusy(true);
    try {
      setUser(await uploadAvatar(file));
      toast("Foto actualizada.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo subir la foto.", "error");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function dropPhoto() {
    setPhotoBusy(true);
    try {
      setUser(await deleteAvatar());
      toast("Foto quitada.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo quitar la foto.", "error");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function toggleRanking(show: boolean) {
    try {
      setUser(await saveProfile({ showInRanking: show }));
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar.", "error");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <VerifyBanner />
      <h1 className="text-3xl font-bold">Mi cuenta</h1>

      <section className="card flex items-center gap-4" aria-label="Foto de perfil">
        <Avatar username={user.username} name={user.displayName} v={user.avatarV} size={80} />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
              {photoBusy ? "Subiendo…" : user.avatarV ? "Cambiar foto" : "Subir foto"}
            </button>
            {user.avatarV > 0 && (
              <button type="button" className="btn-ghost" disabled={photoBusy} onClick={dropPhoto}>
                Quitar
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Elegir foto de perfil" onChange={pickPhoto} />
          <p className="text-xs text-muted">PNG, JPG, WebP o GIF, máx. 2 MB. Se recorta al centro en cuadrado.</p>
        </div>
      </section>

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

      <section className="card">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={user.showInRanking} onChange={(e) => toggleRanking(e.target.checked)} />
          <span>
            <strong>Aparecer en el ranking público</strong>
            <span className="block text-sm text-muted">Se muestra tu usuario, nombre, foto y cuántas solicitudes llevas este mes. Nunca tu correo.</span>
          </span>
        </label>
      </section>

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
