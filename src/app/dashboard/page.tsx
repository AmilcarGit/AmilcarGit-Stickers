"use client";

import Link from "next/link";
import { useAuth, useToast } from "@/components/Providers";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { Avatar } from "@/components/Avatar";
import { VerifiedName } from "@/components/VerifiedName";
import { Mascot } from "@/components/Mascot";
import { createApiKey, listApiKeys, revokeApiKey, fetchRewards, claimDailyReward, type ApiKeyInfo, type ApiQuota, type RewardsData } from "@/lib/data";

function DashboardInner() {
  const toast = useToast();
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [quota, setQuota] = useState<ApiQuota | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const freshInputRef = useRef<HTMLInputElement>(null);
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [rewardBusy, setRewardBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listApiKeys();
      setKeys(data.keys);
      setQuota(data.quota);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudieron cargar tus claves.", "error");
    }
    setLoaded(true);
  }, [toast]);

  useEffect(() => {
    void load();
    void fetchRewards().then(setRewards).catch((err) => toast(err instanceof Error ? err.message : "No se pudieron cargar las recompensas.", "error"));
  }, [load, toast]);

  async function claimDaily() {
    setRewardBusy(true);
    try {
      const result = await claimDailyReward();
      setRewards(result.rewards);
      toast(`¡Ganaste ${result.bonus.points} puntos! Racha: ${result.bonus.streak} días.`, "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo reclamar la bonificación.", "error");
    } finally {
      setRewardBusy(false);
    }
  }

  async function copyReferral() {
    if (!rewards?.referralUrl) return;
    try { await navigator.clipboard.writeText(rewards.referralUrl); toast("Enlace de invitación copiado.", "ok"); }
    catch { toast("No se pudo copiar el enlace.", "error"); }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { key } = await createApiKey(name.trim());
      setFresh(key);
      setName("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear la clave.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(k: ApiKeyInfo) {
    if (!confirm(`¿Revocar la clave «${k.name}»? Los bots que la usen dejarán de funcionar.`)) return;
    try {
      await revokeApiKey(k.id);
      setKeys((list) => list.filter((x) => x.id !== k.id));
      toast("Clave revocada.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo revocar la clave.", "error");
    }
  }

  async function copy(text: string) {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API no disponible");
      }
      toast("Clave copiada al portapapeles.", "ok");
    } catch {
      const field = freshInputRef.current;
      if (field && field.value === text) {
        field.focus();
        field.select();
        field.setSelectionRange(0, field.value.length);
        const copied = document.execCommand("copy");
        if (copied) {
          toast("Clave copiada al portapapeles.", "ok");
        } else {
          toast("La clave quedó seleccionada. Mantén pulsado el campo y elige Copiar.", "error");
        }
      } else {
        toast("No se pudo copiar. Selecciona la clave y cópiala manualmente.", "error");
      }
    }
  }

  const usedPercent = quota ? Math.min(100, Math.max(0, (quota.used / Math.max(1, quota.limit)) * 100)) : 0;
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("es-PE", { month: "long", year: "numeric" }) : "Miembro YuiAPI";

  return (
    <div className="yui-dashboard mx-auto max-w-6xl space-y-6">
      <VerifyBanner />

      <section className="yui-hero" aria-label="Bienvenida">
        <div className="yui-hero-copy">
          <span className="yui-eyebrow"><span className="yui-live-dot" /> TU ESPACIO DE CONTROL</span>
          <h1>Hola, <VerifiedName name={user?.displayName || user?.username || "creador"} badge={user?.verifiedBadge} /> <span className="yui-wave">✦</span></h1>
          <p>Todo lo que necesitas para gestionar tus claves, revisar tu consumo y seguir creciendo con YuiAPI.</p>
          <div className="yui-hero-actions">
            <a href="#mis-claves" className="yui-action-primary">Gestionar mis claves <span aria-hidden="true">↗</span></a>
            <Link href="/docs" className="yui-action-secondary">Ver documentación</Link>
          </div>
          <div className="yui-hero-meta">
            <span><span className="yui-status-dot" /> Cuenta {user?.emailVerified ? "verificada" : "pendiente de verificación"}</span>
            <span>Miembro desde {memberSince}</span>
          </div>
        </div>
        <div className="yui-hero-art" aria-label="Yui, mascota de YuiAPI">
          <div className="yui-orbit yui-orbit-one" />
          <div className="yui-orbit yui-orbit-two" />
          <div className="yui-art-glow" />
          <Mascot size={210} className="yui-mascot" title="Yui, personaje femenino de cabello rosa y moños lavanda" />
          <span className="yui-art-tag">YUI // API</span>
        </div>
      </section>

      <div className="yui-dashboard-layout">
        <aside className="yui-side-nav" aria-label="Navegación del panel">
          <p className="yui-side-label">ESPACIO PERSONAL</p>
          <a className="yui-side-link is-active" href="#resumen"><span>◈</span> Resumen</a>
          <a className="yui-side-link" href="#uso-api"><span>⌁</span> Uso de API</a>
          <a className="yui-side-link" href="#mis-claves"><span>⌘</span> Mis API Keys</a>
          <a className="yui-side-link" href="#recompensas"><span>✧</span> Recompensas</a>
          <a className="yui-side-link" href="#actividad"><span>◷</span> Actividad</a>
          <div className="yui-side-divider" />
          <p className="yui-side-label">CUENTA</p>
          <Link className="yui-side-link" href="/settings"><span>◎</span> Mi perfil</Link>
          <Link className="yui-side-link" href="/docs"><span>▤</span> Documentación</Link>
          <div className="yui-side-help">
            <span className="yui-help-icon">?</span>
            <strong>¿Necesitas ayuda?</strong>
            <p>Consulta la guía para integrar YuiAPI en tus proyectos.</p>
            <Link href="/docs">Abrir documentación ↗</Link>
          </div>
        </aside>

        <div className="yui-dashboard-main">
          <section id="resumen" className="yui-section-block">
            <div className="yui-section-heading">
              <div><span className="yui-kicker">VISTA GENERAL</span><h2>Tu resumen</h2></div>
              <span className="yui-date-label">Datos de tu cuenta</span>
            </div>
            <div className="yui-stat-grid">
              <article className="yui-stat-card"><span className="yui-stat-icon cyan">⌁</span><p>Solicitudes utilizadas</p><strong>{quota ? quota.used.toLocaleString("es-PE") : "—"}</strong><small>En el periodo diario actual</small></article>
              <article className="yui-stat-card"><span className="yui-stat-icon violet">◉</span><p>Solicitudes restantes</p><strong>{quota ? quota.remaining.toLocaleString("es-PE") : "—"}</strong><small>Se renuevan a medianoche de Lima</small></article>
              <article className="yui-stat-card"><span className="yui-stat-icon pink">✧</span><p>Puntos acumulados</p><strong>{rewards ? rewards.points.toLocaleString("es-PE") : "—"}</strong><small>Participa y desbloquea recompensas</small></article>
              <article className="yui-stat-card"><span className="yui-stat-icon blue">⌘</span><p>Claves activas</p><strong>{loaded ? keys.length : "—"}</strong><small>Máximo 5 claves por cuenta</small></article>
            </div>
          </section>

          <section id="uso-api" className="yui-usage-panel">
            <div className="yui-section-heading">
              <div><span className="yui-kicker">CONSUMO</span><h2>Uso de tu API</h2></div>
              {quota && <span className="yui-plan-pill">PLAN {quota.plan.toUpperCase()}</span>}
            </div>
            {quota ? <>
              <div className="yui-usage-numbers"><div><strong>{quota.used.toLocaleString("es-PE")}</strong><span> utilizadas</span></div><div><strong>{quota.remaining.toLocaleString("es-PE")}</strong><span> disponibles</span></div></div>
              <div className="yui-usage-track" role="progressbar" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.used} aria-label="Solicitudes usadas hoy"><span style={{ width: `${usedPercent}%` }} /></div>
              <div className="yui-usage-foot"><span>{usedPercent.toFixed(0)}% del límite diario utilizado</span><span>Límite: {quota.limit.toLocaleString("es-PE")}</span></div>
            </> : <p className="text-muted">Cargando información de consumo…</p>}
          </section>

          {fresh && (
            <section className="yui-key-reveal" role="alert">
              <div><span className="yui-kicker">NUEVA CREDENCIAL</span><h2>Guarda tu API Key</h2><p>Por seguridad solo se muestra una vez. Si la pierdes, revócala y crea otra.</p></div>
              <input ref={freshInputRef} className="input w-full font-mono text-sm" type="text" value={fresh} readOnly aria-label="API Key recién creada" autoComplete="off" spellCheck={false} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} />
              <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" onClick={() => copy(fresh)}>Copiar clave</button><button type="button" className="btn-ghost" onClick={() => setFresh(null)}>Ya la guardé</button></div>
            </section>
          )}

          <section id="mis-claves" className="yui-section-block">
            <div className="yui-section-heading">
              <div><span className="yui-kicker">INTEGRACIONES</span><h2>Mis API Keys</h2><p>Credenciales para conectar tus bots, apps y proyectos.</p></div>
              <span className="yui-count-pill">{keys.length}/5 claves</span>
            </div>
            <div className="yui-key-create">
              <div><span className="yui-create-symbol">＋</span><div><strong>Crear una nueva clave</strong><p>Usa un nombre que te ayude a identificar tu proyecto.</p></div></div>
              <form onSubmit={create} className="yui-create-form">
                <label className="sr-only" htmlFor="keyname">Nombre de la clave</label>
                <input id="keyname" className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mi bot de WhatsApp" required />
                <button type="submit" className="btn-primary" disabled={busy || !name.trim() || keys.length >= 5}>{busy ? "Creando…" : "Crear API Key"}</button>
              </form>
              <p className="hint">Necesitas el correo verificado. Máximo 5 claves activas.</p>
            </div>
            {!loaded ? <p className="text-muted">Cargando tus claves…</p> : keys.length === 0 ? (
              <div className="yui-empty-state"><span>⌘</span><strong>Aún no tienes API Keys</strong><p>Crea tu primera clave para conectar un proyecto con YuiAPI.</p></div>
            ) : (
              <ul className="yui-key-list">
                {keys.map((k) => <li key={k.id} className="yui-key-item"><span className="yui-key-icon">⌘</span><div className="yui-key-info"><strong>{k.name}</strong><code>{k.prefix}••••••••</code><small>Creada {new Date(k.createdAt).toLocaleDateString("es-PE")} · {k.lastUsedAt ? `Último uso ${new Date(k.lastUsedAt).toLocaleString("es-PE")}` : "Todavía no utilizada"}</small></div><span className="yui-key-status">ACTIVA</span><button type="button" className="btn-danger" onClick={() => revoke(k)}>Revocar</button></li>)}
              </ul>
            )}
          </section>

          {rewards && <section id="recompensas" className="yui-section-block">
            <div className="yui-section-heading"><div><span className="yui-kicker">PROGRESO</span><h2>Recompensas y comunidad</h2><p>Tu actividad también suma dentro de YuiAPI.</p></div></div>
            <div className="yui-reward-grid">
              <article className="yui-reward-card"><span className="yui-stat-icon pink">✧</span><p>Tus puntos</p><strong>{rewards.points.toLocaleString("es-PE")}</strong></article>
              <article className="yui-reward-card"><span className="yui-stat-icon violet">♧</span><p>Invitaciones verificadas</p><strong>{rewards.referrals}</strong></article>
              <article className="yui-reward-card"><span className="yui-stat-icon cyan">↗</span><p>Racha diaria</p><strong>{rewards.daily.streak} días</strong></article>
            </div>
            <div className="yui-reward-action"><div><strong>Bonificación diaria</strong><p>Reclama tus puntos y aumenta tu racha cada día.</p></div><button type="button" className="btn-primary" disabled={rewardBusy || rewards.daily.claimed || !user?.emailVerified} onClick={claimDaily}>{rewards.daily.claimed ? "Ya reclamada hoy" : rewardBusy ? "Reclamando…" : `Reclamar +${rewards.daily.nextPoints} puntos`}</button></div>
            {!user?.emailVerified && <p className="hint">Verifica tu correo para reclamar bonificaciones y participar en invitaciones.</p>}
            {rewards.referralUrl && <div className="yui-referral"><div><strong>Invita amigos a YuiAPI</strong><p>Tú recibes 50 puntos y tu amigo 25 cuando verifique su cuenta.</p></div><code>{rewards.referralUrl}</code><button type="button" className="btn-ghost" onClick={copyReferral}>Copiar enlace</button></div>}
            <div className="yui-reward-columns">
              <div className="yui-subpanel"><h3>Insignias</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{rewards.badges.map((badge) => <div key={badge.id} className={`rounded-xl border p-3 ${badge.unlocked ? "border-brand/50 bg-brand/5" : "border-line opacity-60"}`}><p className="font-semibold">{badge.unlocked ? "🏅 " : "🔒 "}{badge.label}</p><p className="text-xs text-muted">{badge.description}</p></div>)}</div></div>
              <div className="yui-subpanel"><h3>Ranking de puntos</h3>{rewards.leaderboard.length ? <ol className="mt-3 space-y-2">{rewards.leaderboard.map((entry) => <li key={entry.username} className="flex items-center justify-between gap-3 text-sm"><span>{entry.rank}. <VerifiedName name={entry.displayName} badge={entry.verifiedBadge} /> <span className="text-muted">@{entry.username}</span></span><strong>{entry.points} pts</strong></li>)}</ol> : <p className="mt-2 text-sm text-muted">Aún no hay participantes.</p>}</div>
            </div>
            <div className="yui-subpanel mt-4"><h3>Historial de puntos</h3>{rewards.history.length ? <ul className="mt-2 space-y-1">{rewards.history.slice(0, 8).map((entry, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 py-2 text-sm last:border-0"><span>{entry.reason}</span><strong className="text-emerald-400">+{entry.amount} pts</strong></li>)}</ul> : <p className="mt-2 text-sm text-muted">Tus movimientos aparecerán aquí.</p>}</div>
          </section>}

          <section id="actividad" className="yui-profile-strip">
            <div className="flex items-center gap-3"><Avatar username={user?.username || "user"} name={user?.displayName || "Usuario"} v={user?.avatarV || 0} size={48} /><div><strong>{user?.displayName || user?.username}</strong><p>@{user?.username} · {user?.plan || "Free"}</p></div></div>
            <Link href="/settings" className="btn-ghost">Configurar perfil ↗</Link>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <RequireAuth><DashboardInner /></RequireAuth>;
}
