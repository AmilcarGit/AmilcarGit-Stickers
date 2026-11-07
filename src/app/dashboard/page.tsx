"use client";

import Link from "next/link";
import { useAuth } from "@/components/Providers";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { useToast } from "@/components/Providers";
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
      try {
        const field = document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        field.style.pointerEvents = "none";
        document.body.appendChild(field);
        field.focus();
        field.select();
        field.setSelectionRange(0, field.value.length);
        const copied = document.execCommand("copy");
        document.body.removeChild(field);
        if (!copied) throw new Error("No se pudo copiar");
        toast("Clave copiada al portapapeles.", "ok");
      } catch {
        toast("No se pudo copiar automáticamente. Mantén pulsada la clave para copiarla.", "error");
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <VerifyBanner />
      <header>
        <h1 className="text-3xl font-bold">Mi panel</h1>
        <p className="mt-1 text-muted">
          Claves para usar la API desde tus bots y apps. Mira los endpoints en la{" "}
          <Link href="/docs" className="text-brand underline">
            documentación
          </Link>
          .
        </p>
      </header>

      {rewards && (
        <section aria-label="Puntos y recompensas" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card"><p className="text-sm text-muted">Tus puntos</p><p className="mt-1 text-3xl font-extrabold text-accent">{rewards.points.toLocaleString("es-PE")}</p></div>
            <div className="card"><p className="text-sm text-muted">Invitaciones verificadas</p><p className="mt-1 text-3xl font-extrabold">{rewards.referrals}</p></div>
            <div className="card"><p className="text-sm text-muted">Racha diaria</p><p className="mt-1 text-3xl font-extrabold">{rewards.daily.streak} días</p></div>
          </div>
          <div className="card flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-bold">Bonificación diaria</h2><p className="text-sm text-muted">Consigue puntos cada día. La recompensa aumenta con tu racha.</p></div>
            <button type="button" className="btn-primary" disabled={rewardBusy || rewards.daily.claimed || !user?.emailVerified} onClick={claimDaily}>
              {rewards.daily.claimed ? "Ya reclamada hoy" : rewardBusy ? "Reclamando…" : `Reclamar +${rewards.daily.nextPoints} puntos`}
            </button>
          </div>
          {!user?.emailVerified && <p className="hint">Verifica tu correo para reclamar bonificaciones y participar en invitaciones.</p>}
          {rewards.referralUrl && (
            <div className="card">
              <h2 className="font-bold">Invita amigos y gana puntos</h2>
              <p className="mt-1 text-sm text-muted">Tú recibes 50 puntos y tu amigo 25 cuando verifique su cuenta.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-surface2 p-3 text-sm">{rewards.referralUrl}</code>
                <button type="button" className="btn-primary" onClick={copyReferral}>Copiar enlace</button>
              </div>
            </div>
          )}
          <div className="card">
            <h2 className="font-bold">Insignias</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {rewards.badges.map((badge) => <div key={badge.id} className={`rounded-xl border p-3 ${badge.unlocked ? "border-brand/50 bg-brand/5" : "border-line opacity-60"}`}><p className="font-semibold">{badge.unlocked ? "🏅 " : "🔒 "}{badge.label}</p><p className="text-xs text-muted">{badge.description}</p></div>)}
            </div>
          </div>
          <div className="card">
            <h2 className="font-bold">Ranking de puntos</h2>
            {rewards.leaderboard.length ? <ol className="mt-3 space-y-2">{rewards.leaderboard.map((entry) => <li key={entry.username} className="flex items-center justify-between gap-3 text-sm"><span>{entry.rank}. {entry.displayName} <span className="text-muted">@{entry.username}</span></span><strong>{entry.points} pts</strong></li>)}</ol> : <p className="mt-2 text-sm text-muted">Aún no hay participantes.</p>}
          </div>
          <div className="card">
            <h2 className="font-bold">Historial de puntos</h2>
            {rewards.history.length ? <ul className="mt-3 space-y-2">{rewards.history.slice(0, 8).map((entry, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 py-2 text-sm last:border-0"><span>{entry.reason}</span><strong className="text-emerald-400">+{entry.amount} pts</strong></li>)}</ul> : <p className="mt-2 text-sm text-muted">Tus movimientos aparecerán aquí.</p>}
          </div>
        </section>
      )}

      {quota && (
        <section aria-label="Uso de hoy" className="card">
          <p className="text-sm text-muted">Plan {quota.plan}</p>
          <p className="text-3xl font-extrabold text-accent">
            {quota.remaining} <span className="text-base font-normal text-muted">de {quota.limit} solicitudes restantes hoy</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.used} aria-label="Solicitudes usadas hoy">
            <div className="h-full bg-brand" style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} />
          </div>
          <p className="hint mt-2">Se renuevan a las 12 a. m. (hora de Lima).</p>
        </section>
      )}

      {fresh && (
        <section className="card border-accent/60" role="alert">
          <h2 className="text-lg font-bold">Copia tu clave ahora</h2>
          <p className="mt-1 text-sm text-muted">Por seguridad solo se muestra una vez. Si la pierdes, revócala y crea otra.</p>
          <code className="mt-3 block break-all rounded-xl bg-surface2 p-3 text-sm">{fresh}</code>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary" onClick={() => copy(fresh)}>
              Copiar
            </button>
            <button type="button" className="btn-ghost" onClick={() => setFresh(null)}>
              Ya la guardé
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="nueva" className="card">
        <h2 id="nueva" className="text-lg font-bold">
          Crear clave
        </h2>
        <form onSubmit={create} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="keyname" className="label">
              Nombre
            </label>
            <input id="keyname" className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mi bot de WhatsApp" required />
          </div>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
            {busy ? "Creando…" : "Crear"}
          </button>
        </form>
        <p className="hint mt-2">Máximo 5 claves. Necesitas el correo verificado.</p>
      </section>

      <section aria-labelledby="claves">
        <h2 id="claves" className="mb-3 text-xl font-bold">
          Mis claves
        </h2>
        {!loaded ? (
          <p className="text-muted">Cargando…</p>
        ) : keys.length === 0 ? (
          <div className="card text-muted">Aún no tienes claves.</div>
        ) : (
          <ul className="space-y-3">
            {keys.map((k) => (
              <li key={k.id} className="card flex flex-wrap items-center justify-between gap-3 !p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{k.name}</p>
                  <p className="text-xs text-muted">
                    <code>{k.prefix}…</code> · creada {new Date(k.createdAt).toLocaleDateString("es")} ·{" "}
                    {k.lastUsedAt ? `último uso ${new Date(k.lastUsedAt).toLocaleString("es")}` : "sin usar"}
                  </p>
                </div>
                <button type="button" className="btn-danger" onClick={() => revoke(k)}>
                  Revocar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}
