"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { Img } from "@/components/Img";
import { useAuth, useToast } from "@/components/Providers";
import { saveProfile } from "@/lib/data";

/** Reduce la foto a 256x256 (recorte centrado) en JPEG para que pese poco. */
async function resizeAvatar(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("La foto no es una imagen válida."));
      img.src = url;
    });
    const size = 256;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) throw new Error("No se pudo procesar la foto.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function SettingsInner() {
  const { user, setUser } = useAuth();
  const profile = user;
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePublic, setProfilePublic] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBio(profile.bio);
      setProfilePublic(profile.profilePublic);
    }
  }, [profile]);

  if (!user || !profile) {
    return (
      <p className="text-muted" role="status">
        Cargando perfil…
      </p>
    );
  }

  const profileUrl = `${typeof window === "undefined" ? "" : window.location.origin}/u/${profile.username}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setBusy(true);
    try {
      const name = displayName.trim().slice(0, 60) || profile.username;
      setUser(await saveProfile({ displayName: name, bio: bio.trim().slice(0, 280), profilePublic }));
      toast("Perfil actualizado.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar el perfil.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setBusy(true);
    try {
      const blob = await resizeAvatar(file);
      const form = new FormData();
      form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      form.append("kind", "avatar");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir la foto.");
      setUser(await saveProfile({ photoURL: data.url }));
      toast("Foto actualizada.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo subir la foto.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast("Enlace copiado.", "ok");
    } catch {
      toast(profileUrl, "info");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <VerifyBanner />
      <h1 className="text-3xl font-bold">Perfil y ajustes</h1>

      <section className="card flex items-center gap-4">
        {profile.photoURL ? (
          <Img src={profile.photoURL} alt="Tu foto de perfil" className="h-20 w-20 rounded-full border border-line object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/30 text-3xl font-bold">{profile.displayName.slice(0, 1).toUpperCase()}</span>
        )}
        <div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatar} />
          <button type="button" className="btn-ghost" disabled={busy || !user.emailVerified} onClick={() => fileRef.current?.click()}>
            Cambiar foto
          </button>
          {!user.emailVerified && <p className="hint">Verifica tu correo para subir una foto.</p>}
        </div>
      </section>

      <form onSubmit={save} className="card space-y-4">
        <div>
          <label htmlFor="name" className="label">
            Nombre del creador
          </label>
          <input id="name" className="input" maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="bio" className="label">
            Biografía
          </label>
          <textarea id="bio" className="input min-h-[96px] py-2" maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} />
          <p className="hint">{bio.length}/280</p>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[rgb(var(--brand))]" checked={profilePublic} onChange={(e) => setProfilePublic(e.target.checked)} />
          <span>
            <strong>Perfil público.</strong> Si lo desactivas, nadie más podrá ver tu perfil (tus paquetes públicos siguen mostrando tu nombre de creador).
          </span>
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      <section className="card space-y-2">
        <h2 className="font-semibold">Tu enlace público</h2>
        <p className="break-all text-sm text-muted">{profileUrl}</p>
        <div className="text-sm text-muted">
          Usuario: <strong className="text-ink">@{profile.username}</strong> (no se puede cambiar) · Correo: {user.email}
        </div>
        <button type="button" onClick={copyLink} className="btn-ghost">
          Copiar enlace
        </button>
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
