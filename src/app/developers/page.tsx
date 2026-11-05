"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { useToast } from "@/components/Providers";
import { createApiKey, listApiKeys, revokeApiKey, type ApiKeyInfo, type ApiQuota } from "@/lib/data";

function DevelopersInner() {
  const toast = useToast();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [quota, setQuota] = useState<ApiQuota | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

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
  }, [load]);

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
      await navigator.clipboard.writeText(text);
      toast("Copiado.", "ok");
    } catch {
      toast("No se pudo copiar; selecciónala y cópiala a mano.", "info");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <VerifyBanner />
      <header>
        <h1 className="text-3xl font-bold">Panel de desarrollador</h1>
        <p className="mt-1 text-muted">
          Claves para usar la API desde tus bots y apps. Mira los endpoints en la{" "}
          <Link href="/docs" className="text-brand underline">
            documentación
          </Link>
          .
        </p>
      </header>

      {quota && (
        <section aria-label="Uso de hoy" className="card">
          <p className="text-sm text-muted">Plan {quota.plan}</p>
          <p className="text-3xl font-extrabold text-gold">
            {quota.remaining} <span className="text-base font-normal text-muted">de {quota.limit} solicitudes restantes hoy</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.used} aria-label="Solicitudes usadas hoy">
            <div className="h-full bg-brand" style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} />
          </div>
          <p className="hint mt-2">Se renuevan a las 12 a. m. (hora de Lima).</p>
        </section>
      )}

      {fresh && (
        <section className="card border-gold/60" role="alert">
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

export default function DevelopersPage() {
  return (
    <RequireAuth>
      <DevelopersInner />
    </RequireAuth>
  );
}
