"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Img } from "@/components/Img";
import { RequireAuth, VerifyBanner } from "@/components/Guards";
import { useAuth, useToast } from "@/components/Providers";
import { deletePack, deleteProject, listFavoriteIds, listMyProjects, listPacksByOwner } from "@/lib/data";
import { listDraft } from "@/lib/draft";
import type { Pack, ProjectSummary } from "@/lib/types";

function DashboardInner() {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [favorites, setFavorites] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [p, k, f] = await Promise.all([listMyProjects(user.uid), listPacksByOwner(user.uid, false), listFavoriteIds(user.uid)]);
      setProjects(p);
      setPacks(k);
      setFavorites(f.length);
    } catch {
      toast("No se pudieron cargar tus datos.", "error");
    }
    try {
      setDraftCount((await listDraft()).length);
    } catch {
      setDraftCount(0);
    }
    setLoaded(true);
  }, [user, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeProject(id: string) {
    if (!confirm("¿Eliminar este proyecto? No se puede deshacer.")) return;
    try {
      await deleteProject(id);
      setProjects((list) => list.filter((p) => p.id !== id));
      toast("Proyecto eliminado.", "ok");
    } catch {
      toast("No se pudo eliminar el proyecto.", "error");
    }
  }

  async function removePack(pack: Pack) {
    if (!confirm(`¿Eliminar el paquete «${pack.title}»? Dejará de estar disponible.`)) return;
    try {
      await deletePack(pack);
      setPacks((list) => list.filter((p) => p.id !== pack.id));
      await refreshProfile();
      toast("Paquete eliminado.", "ok");
    } catch {
      toast("No se pudo eliminar el paquete.", "error");
    }
  }

  const stats = [
    { label: "Proyectos", value: projects.length },
    { label: "Paquetes publicados", value: profile?.packCount ?? 0 },
    { label: "Stickers publicados", value: profile?.stickerCount ?? 0 },
    { label: "Favoritos guardados", value: favorites },
  ];

  return (
    <div className="space-y-10">
      <VerifyBanner />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hola, {profile?.displayName || user?.displayName || "creador"} 👑</h1>
          <p className="mt-1 text-muted">
            {profile ? (
              <>
                Miembro desde {new Date(profile.createdAt).toLocaleDateString("es", { year: "numeric", month: "long" })} ·{" "}
                <Link className="text-brand hover:underline" href={`/u/${profile.username}`}>
                  Ver mi perfil público
                </Link>
              </>
            ) : (
              "Tu panel de creador"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/editor" className="btn-primary">
            Nuevo sticker
          </Link>
          <Link href="/pack/new" className="btn-ghost">
            Mi paquete en borrador{draftCount > 0 ? ` (${draftCount})` : ""}
          </Link>
        </div>
      </section>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card !p-4">
            <p className="text-3xl font-extrabold text-gold">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="proyectos">
        <h2 id="proyectos" className="mb-4 text-xl font-bold">
          Mis proyectos
        </h2>
        {!loaded ? (
          <p className="text-muted">Cargando…</p>
        ) : projects.length === 0 ? (
          <div className="card text-muted">
            Aún no guardaste proyectos.{" "}
            <Link href="/editor" className="text-brand underline">
              Abre el editor
            </Link>{" "}
            y crea el primero.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {projects.map((p) => (
              <li key={p.id} className="card !p-3">
                <Link href={`/editor?project=${p.id}`} className="block">
                  <div className="checker aspect-square overflow-hidden rounded-xl">
                    {p.thumb ? <Img src={p.thumb} alt={`Vista previa de ${p.name}`} className="h-full w-full object-contain" /> : null}
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold">{p.name}</p>
                </Link>
                <button type="button" onClick={() => removeProject(p.id)} className="mt-2 text-xs text-danger hover:underline">
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="paquetes">
        <h2 id="paquetes" className="mb-4 text-xl font-bold">
          Mis paquetes
        </h2>
        {!loaded ? null : packs.length === 0 ? (
          <div className="card text-muted">
            Todavía no publicaste paquetes. Crea stickers, agrégalos al borrador y publícalo en{" "}
            <Link href="/pack/new" className="text-brand underline">
              Mi paquete
            </Link>
            .
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {packs.map((p) => (
              <li key={p.id} className="card flex items-center gap-4 !p-4">
                <Img src={p.trayUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-line object-contain" />
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${p.id}`} className="block truncate font-semibold hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {p.stickers.length} stickers · {p.animated ? "animado" : "estático"} · {p.visibility === "public" ? "público" : "privado"} · ♥ {p.favCount} · ↓ {p.downloadCount}
                  </p>
                  {p.status === "removed" && <p className="mt-1 text-xs font-semibold text-danger">Retirado por moderación</p>}
                </div>
                <button type="button" onClick={() => removePack(p)} className="text-xs text-danger hover:underline">
                  Eliminar
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
