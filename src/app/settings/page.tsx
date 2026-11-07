"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { useAuth, useToast } from "@/components/Providers";
import { Avatar } from "@/components/Avatar";
import { deleteAvatar, fetchMyStats, fetchRewards, listApiKeys, saveProfile, uploadAvatar, type ApiKeyInfo, type ApiQuota, type RewardsData } from "@/lib/data";

const LEVELS = [
  { name: "Principiante", min: 0, next: 100 },
  { name: "Explorador", min: 100, next: 300 },
  { name: "Avanzado", min: 300, next: 700 },
  { name: "Experto", min: 700, next: 1500 },
  { name: "Leyenda", min: 1500, next: 3000 },
  { name: "Élite", min: 3000, next: 3000 },
];

function dateLabel(value?: number | null) {
  if (!value) return "Sin vencimiento";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function ProfileInner() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [quota, setQuota] = useState<ApiQuota | null>(null);
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [dataBusy, setDataBusy] = useState(true);
  const [requestsThisMonth, setRequestsThisMonth] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setBio(user.bio ?? "");
    setLocation(user.location ?? "");
  }, [user]);

  useEffect(() => {
    let active = true;
    setDataBusy(true);
    void Promise.allSettled([listApiKeys(), fetchRewards(), fetchMyStats()]).then(([keyResult, rewardResult, statsResult]) => {
      if (!active) return;
      if (keyResult.status === "fulfilled") {
        setKeys(keyResult.value.keys);
        setQuota(keyResult.value.quota);
      } else {
        toast(keyResult.reason instanceof Error ? keyResult.reason.message : "No se pudieron cargar tus claves.", "error");
      }
      if (rewardResult.status === "fulfilled") setRewards(rewardResult.value);
      else toast(rewardResult.reason instanceof Error ? rewardResult.reason.message : "No se pudieron cargar tus recompensas.", "error");
      setDataBusy(false);
    });
    return () => { active = false; };
  }, [toast]);

  if (!user) return <p className="text-muted" role="status">Cargando perfil…</p>;

  const points = rewards?.points ?? 0;
  const levelIndex = LEVELS.reduce((current, level, index) => points >= level.min ? index : current, 0);
  const level = LEVELS[levelIndex];
  const nextLevel = LEVELS[Math.min(levelIndex + 1, LEVELS.length - 1)];
  const progress = levelIndex === LEVELS.length - 1 ? 100 : Math.max(0, Math.min(100, ((points - level.min) / (nextLevel.min - level.min)) * 100));
  const usagePercent = quota && quota.limit > 0 ? Math.min(100, (quota.used / quota.limit) * 100) : 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await saveProfile({ displayName: displayName.trim().slice(0, 60), bio: bio.trim().slice(0, 160), location: location.trim().slice(0, 60) });
      setUser(updated);
      toast("Tu perfil se guardó correctamente.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar el perfil.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return toast("Usa una imagen PNG, JPG, WebP o GIF.", "error");
    if (file.size > 2 * 1024 * 1024) return toast("La foto pesa más de 2 MB.", "error");
    setPhotoBusy(true);
    try {
      setUser(await uploadAvatar(file));
      toast("Foto de perfil actualizada.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo subir la foto.", "error");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (!window.confirm("¿Quieres quitar tu foto de perfil?")) return;
    setPhotoBusy(true);
    try {
      setUser(await deleteAvatar());
      toast("Foto de perfil eliminada.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo quitar la foto.", "error");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function toggleRanking(show: boolean) {
    setPrivacyBusy(true);
    try {
      setUser(await saveProfile({ showInRanking: show }));
      toast(show ? "Tu perfil volverá a aparecer en el ranking." : "Tu perfil ya no aparecerá en el ranking.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo actualizar la privacidad.", "error");
    } finally {
      setPrivacyBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <VerifyBanner />
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">YuiAPI · Cuenta personal</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Mi perfil</h1>
        <p className="max-w-2xl text-muted">Administra tu identidad, revisa tu progreso y controla el uso de tus herramientas API desde un solo lugar.</p>
      </header>

      <section className="relative overflow-hidden rounded-3xl border border-brand/30 bg-gradient-to-br from-brand/20 via-surface to-accent/10 p-5 sm:p-7" aria-label="Resumen del perfil">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="rounded-full border-4 border-surface shadow-xl"><Avatar username={user.username} name={user.displayName} v={user.avatarV} size={88} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-2xl font-bold">{user.displayName}</h2>
              {user.admin && <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">Administrador</span>}
            </div>
            <p className="text-sm text-muted">@{user.username}</p>
            <p className="mt-2 text-sm">{user.bio || "Aún no has añadido una biografía."}</p>
            {user.location && <p className="mt-1 text-xs text-muted">⌖ {user.location}</p>}
          </div>
          <div className="rounded-2xl border border-line bg-bg/50 px-4 py-3">
            <p className="text-xs text-muted">Nivel actual</p>
            <p className="text-lg font-bold text-accent">{level.name}</p>
            <p className="text-xs text-muted">{points.toLocaleString("es-PE")} puntos</p>
          </div>
        </div>
        <div className="relative mt-6">
          <div className="mb-2 flex justify-between gap-3 text-xs text-muted">
            <span>Progreso de nivel</span>
            <span>{levelIndex === LEVELS.length - 1 ? "Nivel máximo" : points.toLocaleString("es-PE") + " / " + nextLevel.min.toLocaleString("es-PE") + " pts"}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-bg/80" role="progressbar" aria-label="Progreso al siguiente nivel" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-[width]" style={{ width: progress + "%" }} />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card"><p className="text-sm text-muted">Puntos acumulados</p><p className="mt-1 text-2xl font-extrabold text-accent">{points.toLocaleString("es-PE")}</p></div>
        <div className="card"><p className="text-sm text-muted">Invitaciones verificadas</p><p className="mt-1 text-2xl font-extrabold">{rewards?.referrals ?? "—"}</p></div>
        <div className="card"><p className="text-sm text-muted">Racha diaria</p><p className="mt-1 text-2xl font-extrabold">{rewards ? rewards.daily.streak + " días" : "—"}</p></div>
        <div className="card"><p className="text-sm text-muted">Solicitudes este mes</p><p className="mt-1 text-2xl font-extrabold">{requestsThisMonth === null ? "…" : requestsThisMonth.toLocaleString("es-PE")}</p></div>\n        <div className="card"><p className="text-sm text-muted">Claves API activas</p><p className="mt-1 text-2xl font-extrabold">{dataBusy ? "…" : keys.length}</p></div>
      </div>

      <section className="card space-y-4">
        <div><h2 className="text-xl font-bold">Tu identidad</h2><p className="mt-1 text-sm text-muted">Personaliza cómo apareces en YuiAPI. Tu correo y tu identificador no se muestran en el ranking.</p></div>
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-bg/40 p-4">
          <Avatar username={user.username} name={user.displayName} v={user.avatarV} size={72} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={photoBusy} onClick={() => fileRef.current?.click()}>{photoBusy ? "Procesando…" : user.avatarV ? "Cambiar foto" : "Subir foto"}</button>
            {user.avatarV > 0 && <button type="button" className="btn-ghost" disabled={photoBusy} onClick={removePhoto}>Quitar foto</button>}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Elegir foto de perfil" onChange={pickPhoto} />
          </div>
          <p className="w-full text-xs text-muted">PNG, JPG, WebP o GIF · máximo 2 MB · la imagen se optimiza automáticamente.</p>
        </div>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="display-name" className="label">Nombre visible</label><input id="display-name" className="input" maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></div>
          <div><label htmlFor="profile-location" className="label">Ubicación (opcional)</label><input id="profile-location" className="input" maxLength={60} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ej. Perú" /></div>
          <div className="sm:col-span-2"><label htmlFor="profile-bio" className="label">Biografía</label><textarea id="profile-bio" className="input min-h-24 resize-y py-3" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Cuéntales un poco sobre ti…" /><p className="hint text-right">{bio.length}/160</p></div>
          <div className="sm:col-span-2"><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar perfil"}</button></div>
        </form>
      </section>

      <section className="card space-y-4">
        <div><h2 className="text-xl font-bold">Plan y consumo de API</h2><p className="mt-1 text-sm text-muted">Consulta tu membresía y el límite de solicitudes disponible hoy.</p></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bg/50 p-4">
          <div><p className="text-xs text-muted">Plan actual</p><p className="text-2xl font-extrabold capitalize text-accent">{user.plan}</p></div>
          <div className="text-right text-sm"><p className="text-muted">Vencimiento</p><p className="font-semibold">{dateLabel(user.planExpiresAt)}</p></div>
        </div>
        {quota && <>
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-muted">Solicitudes utilizadas hoy</span><strong>{quota.used.toLocaleString("es-PE")} / {quota.limit.toLocaleString("es-PE")}</strong></div>
          <div className="h-3 overflow-hidden rounded-full bg-bg" role="progressbar" aria-label="Consumo diario de API" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.used}><div className="h-full rounded-full bg-brand" style={{ width: usagePercent + "%" }} /></div>
          <p className="text-xs text-muted">Te quedan {quota.remaining.toLocaleString("es-PE")} solicitudes. El límite se renueva a medianoche, hora de Lima.</p>
        </>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div><p className="font-semibold">Tus claves API</p><p className="text-xs text-muted">{keys.length} de 5 claves activas</p></div>
          <Link href="/dashboard" className="btn-ghost">Administrar claves</Link>
        </div>
        {!dataBusy && keys.length === 0 && <p className="text-sm text-muted">Todavía no has creado claves API.</p>}
        {keys.length > 0 && <ul className="space-y-2">{keys.map((key) => <li key={key.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm"><span className="font-medium">{key.name}</span><code className="text-xs text-muted">{key.prefix}…</code></li>)}</ul>}
      </section>

      <section className="card space-y-4">
        <div><h2 className="text-xl font-bold">Logros y recompensas</h2><p className="mt-1 text-sm text-muted">Tu actividad también suma puntos, rachas e insignias.</p></div>
        {rewards ? <>
          <div className="grid gap-2 sm:grid-cols-2">{rewards.badges.map((badge) => <div key={badge.id} className={"rounded-xl border p-3 " + (badge.unlocked ? "border-brand/50 bg-brand/10" : "border-line opacity-65")}><p className="font-semibold">{badge.unlocked ? "🏅" : "🔒"} {badge.label}</p><p className="mt-1 text-xs text-muted">{badge.description}</p></div>)}</div>
          <div className="rounded-xl border border-line p-4"><p className="font-semibold">Actividad reciente de puntos</p>{rewards.history.length ? <ul className="mt-2 divide-y divide-line/70">{rewards.history.slice(0, 5).map((entry, index) => <li key={entry.at + "-" + index} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{entry.reason}</span><strong className="text-ok">+{entry.amount} pts</strong></li>)}</ul> : <p className="mt-2 text-sm text-muted">Tus movimientos aparecerán aquí.</p>}</div>
        </> : <p className="text-sm text-muted">{dataBusy ? "Cargando logros…" : "No se pudieron cargar tus logros en este momento."}</p>}
        <Link href="/dashboard" className="btn-ghost w-fit">Ver todas las recompensas</Link>
      </section>

      <section className="card space-y-3">
        <div><h2 className="text-xl font-bold">Privacidad y cuenta</h2><p className="mt-1 text-sm text-muted">Tú decides si participas en el ranking público.</p></div>
        <label className="flex items-start gap-3 rounded-xl border border-line p-4">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={user.showInRanking} disabled={privacyBusy} onChange={(e) => void toggleRanking(e.target.checked)} />
          <span><strong>Aparecer en el ranking público</strong><span className="mt-1 block text-sm text-muted">Si lo desactivas, tu nombre, foto y actividad dejarán de mostrarse en el ranking. Tu cuenta y tus claves seguirán funcionando.</span></span>
        </label>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-bg/50 p-3"><p className="text-xs text-muted">Nombre de usuario</p><p className="font-semibold">@{user.username}</p><p className="text-xs text-muted">No se puede cambiar.</p></div>
          <div className="rounded-xl bg-bg/50 p-3"><p className="text-xs text-muted">Correo electrónico</p><p className="break-all font-semibold">{user.email}</p><p className={user.emailVerified ? "text-xs text-ok" : "text-xs text-danger"}>{user.emailVerified ? "Correo verificado" : "Pendiente de verificación"}</p></div>
          <div className="rounded-xl bg-bg/50 p-3 sm:col-span-2"><p className="text-xs text-muted">Miembro desde</p><p className="font-semibold">{dateLabel(user.createdAt)}</p></div>
        </div>
        <p className="text-xs text-muted">Para cambiar tu contraseña, utiliza el proceso de recuperación desde la pantalla de inicio de sesión. El correo de acceso no se puede editar desde este perfil.</p>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return <RequireAuth><ProfileInner /></RequireAuth>;
}
