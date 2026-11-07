"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { useAuth, useToast } from "@/components/Providers";
import { Avatar } from "@/components/Avatar";
import { VerifiedName } from "@/components/VerifiedName";
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
      } else toast(keyResult.reason instanceof Error ? keyResult.reason.message : "No se pudieron cargar tus claves.", "error");
      if (rewardResult.status === "fulfilled") setRewards(rewardResult.value);
      else toast(rewardResult.reason instanceof Error ? rewardResult.reason.message : "No se pudieron cargar tus recompensas.", "error");
      if (statsResult.status === "fulfilled") setRequestsThisMonth(statsResult.value.requestsThisMonth);
      else toast(statsResult.reason instanceof Error ? statsResult.reason.message : "No se pudieron cargar tus estadísticas.", "error");
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
    } finally { setSaving(false); }
  }

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return toast("Usa una imagen PNG, JPG, WebP o GIF.", "error");
    if (file.size > 2 * 1024 * 1024) return toast("La foto pesa más de 2 MB.", "error");
    setPhotoBusy(true);
    try { setUser(await uploadAvatar(file)); toast("Foto de perfil actualizada.", "ok"); }
    catch (err) { toast(err instanceof Error ? err.message : "No se pudo subir la foto.", "error"); }
    finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    if (!window.confirm("¿Quieres quitar tu foto de perfil?")) return;
    setPhotoBusy(true);
    try { setUser(await deleteAvatar()); toast("Foto de perfil eliminada.", "ok"); }
    catch (err) { toast(err instanceof Error ? err.message : "No se pudo quitar la foto.", "error"); }
    finally { setPhotoBusy(false); }
  }

  async function toggleRanking(show: boolean) {
    setPrivacyBusy(true);
    try { setUser(await saveProfile({ showInRanking: show })); toast(show ? "Tu perfil volverá a aparecer en el ranking." : "Tu perfil ya no aparecerá en el ranking.", "ok"); }
    catch (err) { toast(err instanceof Error ? err.message : "No se pudo actualizar la privacidad.", "error"); }
    finally { setPrivacyBusy(false); }
  }

  return (
    <div className="yui-profile-page mx-auto max-w-6xl space-y-6">
      <VerifyBanner />
      <section className="yui-profile-hero">
        <div className="yui-profile-hero-copy">
          <span className="yui-eyebrow"><span className="yui-live-dot" /> CENTRO DE IDENTIDAD</span>
          <h1>Tu perfil, tu universo<span> ✦</span></h1>
          <p>Administra tu identidad, personaliza tu presencia y consulta tu progreso dentro de YuiAPI.</p>
          <div className="yui-profile-hero-meta">
            <span className="yui-profile-verified"><i /> {user.emailVerified ? "Correo verificado" : "Verificación pendiente"}</span>
            <span>@{user.username}</span>
          </div>
        </div>
        <div className="yui-profile-hero-user">
          <div className="yui-profile-avatar-ring"><Avatar username={user.username} name={user.displayName} v={user.avatarV} size={104} /></div>
          <strong><VerifiedName name={user.displayName} badge={user.verifiedBadge} /></strong>
          <span>{user.admin ? "Administradora" : "Miembro YuiAPI"}</span>
          <b>{level.name}</b>
        </div>
        <div className="yui-profile-hero-orbit" />
      </section>

      <div className="yui-profile-layout">
        <aside className="yui-side-nav yui-profile-nav" aria-label="Secciones del perfil">
          <p className="yui-side-label">MI CUENTA</p>
          <a className="yui-side-link is-active" href="#perfil-identidad"><span>◎</span> Identidad</a>
          <a className="yui-side-link" href="#perfil-progreso"><span>✧</span> Progreso</a>
          <a className="yui-side-link" href="#perfil-plan"><span>◈</span> Plan y consumo</a>
          <a className="yui-side-link" href="#perfil-logros"><span>♧</span> Logros</a>
          <a className="yui-side-link" href="#perfil-privacidad"><span>⌑</span> Privacidad</a>
          <div className="yui-side-divider" />
          <Link className="yui-side-link" href="/dashboard"><span>⌂</span> Volver al dashboard</Link>
          <Link className="yui-side-link" href="/docs"><span>▤</span> Documentación</Link>
          <div className="yui-side-help"><span className="yui-help-icon">?</span><strong>Tu cuenta segura</strong><p>Tu correo y tu identificador no se muestran en el ranking público.</p><Link href="/docs">Consultar ayuda ↗</Link></div>
        </aside>

        <main className="yui-profile-main">
          <section id="perfil-progreso" className="yui-section-block">
            <div className="yui-section-heading"><div><span className="yui-kicker">TU ACTIVIDAD</span><h2>Resumen de progreso</h2></div><span className="yui-plan-pill">NIVEL {levelIndex + 1}</span></div>
            <div className="yui-profile-stats">
              <article className="yui-stat-card"><span className="yui-stat-icon pink">✧</span><p>Puntos acumulados</p><strong>{points.toLocaleString("es-PE")}</strong><small>Tu progreso en la comunidad</small></article>
              <article className="yui-stat-card"><span className="yui-stat-icon violet">♧</span><p>Invitaciones verificadas</p><strong>{rewards?.referrals ?? "—"}</strong><small>Amigos que se unieron</small></article>
              <article className="yui-stat-card"><span className="yui-stat-icon cyan">◷</span><p>Racha diaria</p><strong>{rewards ? rewards.daily.streak + " días" : "—"}</strong><small>Constancia en YuiAPI</small></article>
              <article className="yui-stat-card"><span className="yui-stat-icon blue">⌁</span><p>Solicitudes este mes</p><strong>{requestsThisMonth === null ? "—" : requestsThisMonth.toLocaleString("es-PE")}</strong><small>Uso de tus integraciones</small></article>
            </div>
            <div className="yui-level-panel"><div className="yui-level-heading"><div><span className="yui-kicker">RANGO ACTUAL</span><h3>{level.name}</h3></div><strong>{levelIndex === LEVELS.length - 1 ? "Nivel máximo" : points.toLocaleString("es-PE") + " / " + nextLevel.min.toLocaleString("es-PE") + " pts"}</strong></div><div className="yui-usage-track" role="progressbar" aria-label="Progreso al siguiente nivel" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: progress + "%" }} /></div><p>{levelIndex === LEVELS.length - 1 ? "Has alcanzado el rango más alto disponible." : "Te faltan " + Math.max(0, nextLevel.min - points).toLocaleString("es-PE") + " puntos para alcanzar " + nextLevel.name + "."}</p></div>
          </section>

          <section id="perfil-identidad" className="yui-section-block">
            <div className="yui-section-heading"><div><span className="yui-kicker">PERSONALIZACIÓN</span><h2>Tu identidad</h2><p>Así te verá la comunidad de YuiAPI.</p></div></div>
            <div className="yui-avatar-editor"><Avatar username={user.username} name={user.displayName} v={user.avatarV} size={76} /><div className="yui-avatar-editor-copy"><strong>Foto de perfil</strong><p>PNG, JPG, WebP o GIF · máximo 2 MB.</p><div className="flex flex-wrap gap-2 mt-2"><button type="button" className="btn-primary" disabled={photoBusy} onClick={() => fileRef.current?.click()}>{photoBusy ? "Procesando…" : user.avatarV ? "Cambiar foto" : "Subir foto"}</button>{user.avatarV > 0 && <button type="button" className="btn-ghost" disabled={photoBusy} onClick={removePhoto}>Quitar foto</button>}</div><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" aria-label="Elegir foto de perfil" onChange={pickPhoto} /></div></div>
            <form onSubmit={save} className="yui-profile-form">
              <div><label htmlFor="display-name" className="label">Nombre visible</label><input id="display-name" className="input" maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></div>
              <div><label htmlFor="profile-location" className="label">Ubicación (opcional)</label><input id="profile-location" className="input" maxLength={60} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ej. Perú" /></div>
              <div className="yui-profile-form-wide"><label htmlFor="profile-bio" className="label">Biografía</label><textarea id="profile-bio" className="input min-h-24 resize-y py-3" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Cuéntales un poco sobre ti…" /><p className="hint text-right">{bio.length}/160</p></div>
              <div className="yui-profile-form-wide flex justify-end"><button type="submit" className="btn-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div>
            </form>
          </section>

          <section id="perfil-plan" className="yui-section-block">
            <div className="yui-section-heading"><div><span className="yui-kicker">MEMBRESÍA</span><h2>Plan y consumo de API</h2><p>Estado actual de tu cuenta y disponibilidad diaria.</p></div></div>
            <div className="yui-plan-summary"><div><span>PLAN ACTUAL</span><strong>{user.plan}</strong></div><div><span>VENCIMIENTO</span><strong>{dateLabel(user.planExpiresAt)}</strong></div><div><span>CLAVES ACTIVAS</span><strong>{dataBusy ? "…" : keys.length + " / 5"}</strong></div></div>
            {quota && <div className="yui-plan-usage"><div className="yui-usage-numbers"><div><strong>{quota.used.toLocaleString("es-PE")}</strong><span> utilizadas hoy</span></div><div><strong>{quota.remaining.toLocaleString("es-PE")}</strong><span> disponibles</span></div></div><div className="yui-usage-track" role="progressbar" aria-label="Consumo diario de API" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.used}><span style={{ width: usagePercent + "%" }} /></div><div className="yui-usage-foot"><span>{usagePercent.toFixed(0)}% del límite diario</span><span>Límite: {quota.limit.toLocaleString("es-PE")}</span></div><p className="hint mt-2">El límite se renueva a medianoche, hora de Lima.</p></div>}
            <div className="yui-profile-key-footer"><div><strong>Tus claves API</strong><p>{keys.length} de 5 claves activas. Las credenciales completas solo se muestran al crearlas.</p></div><Link href="/dashboard" className="btn-ghost">Administrar claves ↗</Link></div>
            {!dataBusy && keys.length === 0 && <p className="text-sm text-muted mt-3">Todavía no has creado claves API.</p>}
            {keys.length > 0 && <ul className="yui-profile-key-list">{keys.map((key) => <li key={key.id}><span className="yui-key-icon">⌘</span><div><strong>{key.name}</strong><code>{key.prefix}••••••••</code></div><span className="yui-key-status">ACTIVA</span></li>)}</ul>}
          </section>

          <section id="perfil-logros" className="yui-section-block">
            <div className="yui-section-heading"><div><span className="yui-kicker">RECONOCIMIENTOS</span><h2>Logros e historial</h2><p>Insignias desbloqueadas y movimientos recientes de puntos.</p></div><Link href="/dashboard#recompensas" className="yui-inline-link">Ver recompensas ↗</Link></div>
            {rewards ? <>
              <div className="yui-badge-grid">{rewards.badges.map((badge) => <article key={badge.id} className={"yui-badge-card " + (badge.unlocked ? "is-unlocked" : "is-locked")}><span>{badge.unlocked ? "🏅" : "🔒"}</span><div><strong>{badge.label}</strong><p>{badge.description}</p></div><small>{badge.unlocked ? "DESBLOQUEADA" : "BLOQUEADA"}</small></article>)}</div>
              <div className="yui-subpanel mt-4"><h3>Historial de puntos</h3>{rewards.history.length ? <ul className="mt-2">{rewards.history.slice(0, 8).map((entry, index) => <li key={entry.at + "-" + index} className="yui-points-row"><div><strong>{entry.reason}</strong><small>{new Date(entry.at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</small></div><b>+{entry.amount} pts</b></li>)}</ul> : <p className="mt-2 text-sm text-muted">Tus movimientos aparecerán aquí.</p>}</div>
            </> : <p className="text-sm text-muted">{dataBusy ? "Cargando logros…" : "No se pudieron cargar tus logros en este momento."}</p>}
          </section>

          <section id="perfil-privacidad" className="yui-section-block">
            <div className="yui-section-heading"><div><span className="yui-kicker">CONTROL DE DATOS</span><h2>Privacidad y cuenta</h2><p>Gestiona la visibilidad de tu perfil público.</p></div></div>
            <label className="yui-privacy-toggle"><input type="checkbox" className="h-5 w-5 accent-brand" checked={user.showInRanking} disabled={privacyBusy} onChange={(e) => void toggleRanking(e.target.checked)} /><span><strong>Aparecer en el ranking público</strong><small>Si lo desactivas, tu nombre, foto y actividad dejarán de mostrarse en el ranking. Tu cuenta y tus claves seguirán funcionando.</small></span></label>
            <div className="yui-account-grid">
              <div><span>NOMBRE DE USUARIO</span><strong>@{user.username}</strong><small>No se puede cambiar.</small></div>
              <div><span>CORREO ELECTRÓNICO</span><strong className="break-all">{user.email}</strong><small className={user.emailVerified ? "text-ok" : "text-danger"}>{user.emailVerified ? "Correo verificado" : "Pendiente de verificación"}</small></div>
              <div><span>MIEMBRO DESDE</span><strong>{dateLabel(user.createdAt)}</strong></div>
            </div>
            <p className="hint mt-4">Para cambiar tu contraseña, utiliza el proceso de recuperación desde la pantalla de inicio de sesión. El correo de acceso no se puede editar desde este perfil.</p>
          </section>
        </main>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <RequireAuth><ProfileInner /></RequireAuth>;
}
