"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchRanking } from "@/lib/data";
import type { RankingEntry } from "@/lib/types";
import { Avatar } from "./Avatar";

const medals = ["🥇", "🥈", "🥉"];

/** Los 3 primeros del ranking del mes (datos reales; si aún no hay nadie, invita a ser el primero). */
export function TopRanking() {
  const [entries, setEntries] = useState<RankingEntry[] | null>(null);

  useEffect(() => {
    fetchRanking()
      .then((r) => setEntries(r.entries.slice(0, 3)))
      .catch(() => setEntries([]));
  }, []);

  return (
    <section aria-labelledby="top-mes" className="card space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="top-mes" className="text-xl font-bold">
          Quién más usa YuiApi este mes
        </h2>
        <Link href="/ranking" className="text-sm text-brand underline">
          Ver ranking
        </Link>
      </div>
      {entries === null && (
        <p className="text-sm text-muted" role="status">
          Cargando…
        </p>
      )}
      {entries && entries.length === 0 && <p className="text-sm text-muted">Todavía nadie ha usado la API este mes. ¡Sé la primera persona!</p>}
      {entries && entries.length > 0 && (
        <ol className="grid gap-3 sm:grid-cols-3">
          {entries.map((e) => (
            <li key={e.username} className="flex items-center gap-3 rounded-xl bg-surface2 p-3">
              <span className="text-2xl" aria-label={`Puesto ${e.rank}`}>
                {medals[e.rank - 1]}
              </span>
              <Avatar username={e.username} name={e.displayName} v={e.avatarV} size={40} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{e.displayName}</p>
                <p className="text-xs text-muted">{e.count.toLocaleString("es")} solicitudes</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
