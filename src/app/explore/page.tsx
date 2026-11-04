"use client";

import { useEffect, useMemo, useState } from "react";
import { PackCard } from "@/components/PackCard";
import { useAuth } from "@/components/Providers";
import { listMyFavorites, listPublicPacks } from "@/lib/data";
import { CATEGORIES, type Pack } from "@/lib/types";

type Sort = "recent" | "trending" | "downloads";

const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Recientes" },
  { id: "trending", label: "Tendencias" },
  { id: "downloads", label: "Más descargados" },
];

export default function ExplorePage() {
  const { user } = useAuth();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("Todas");
  const [sort, setSort] = useState<Sort>("recent");
  const [onlyFavs, setOnlyFavs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPublicPacks()
      .then((list) => !cancelled && setPacks(list))
      .catch(() => !cancelled && setError("No se pudieron cargar los paquetes."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setFavIds([]);
      return;
    }
    listMyFavorites()
      .then((list) => setFavIds(list.map((p) => p.id)))
      .catch(() => setFavIds([]));
  }, [user]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = packs.filter((p) => {
      if (category !== "Todas" && p.category !== category) return false;
      if (onlyFavs && !favIds.includes(p.id)) return false;
      if (!term) return true;
      return [p.title, p.description, p.ownerName, p.ownerUsername, ...p.tags].some((t) => t.toLowerCase().includes(term));
    });
    list = [...list];
    if (sort === "trending") list.sort((a, b) => b.favCount - a.favCount || b.createdAt - a.createdAt);
    if (sort === "downloads") list.sort((a, b) => b.downloadCount - a.downloadCount || b.createdAt - a.createdAt);
    return list;
  }, [packs, q, category, sort, onlyFavs, favIds]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Explorar paquetes</h1>
        <p className="mt-1 text-muted">Descubre stickers creados por la comunidad.</p>
      </header>

      <div className="space-y-4">
        <div>
          <label htmlFor="q" className="sr-only">
            Buscar paquetes
          </label>
          <input id="q" type="search" className="input" placeholder="Buscar por nombre, etiqueta o creador…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Orden">
          {SORTS.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
              {s.label}
            </button>
          ))}
          {user && (
            <button type="button" className="chip" aria-pressed={onlyFavs} onClick={() => setOnlyFavs((v) => !v)}>
              ♥ Mis favoritos
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías">
          {["Todas", ...CATEGORIES].map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted" role="status">
          Cargando paquetes…
        </p>
      ) : error ? (
        <p className="text-danger" role="alert">
          {error}
        </p>
      ) : shown.length === 0 ? (
        <div className="card text-muted">
          {packs.length === 0 ? "Aún no hay paquetes publicados. ¡Sé la primera persona en publicar uno!" : "No encontramos paquetes con esos filtros."}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id}>
              <PackCard pack={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
