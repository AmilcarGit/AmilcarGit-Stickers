"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { VerifiedName } from "@/components/VerifiedName";
import { fetchRanking } from "@/lib/data";
import type { RankingEntry } from "@/lib/types";

const medals = ["🥇", "🥈", "🥉"];

export default function RankingPage() {
  const [data, setData] = useState<{ month: string; entries: RankingEntry[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRanking()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el ranking."));
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Ranking del mes</h1>
        <p className="mt-1 text-muted">
          Quién más usa YuiApi{data ? ` en ${data.month}` : ""}. Se reinicia cada mes (hora de Lima). Puedes salir del ranking desde{" "}
          <Link href="/settings" className="text-brand underline">
            Mi cuenta
          </Link>
          .
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="text-muted" role="status">
          Cargando…
        </p>
      )}
      {data && data.entries.length === 0 && <p className="card text-muted">Todavía nadie ha usado la API este mes. ¡Sé la primera persona!</p>}

      {data && data.entries.length > 0 && (
        <ol className="space-y-2">
          {data.entries.map((e) => (
            <li key={e.username} className="card flex items-center gap-3 !p-3">
              <span className="w-8 text-center text-xl font-bold" aria-label={`Puesto ${e.rank}`}>
                {medals[e.rank - 1] ?? e.rank}
              </span>
              <Avatar username={e.username} name={e.displayName} v={e.avatarV} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold"><VerifiedName name={e.displayName} badge={e.verifiedBadge} /></p>
                <p className="truncate text-sm text-muted">@{e.username}</p>
              </div>
              <p className="text-right text-sm">
                <strong className="text-lg text-brand">{e.count.toLocaleString("es")}</strong>
                <br />
                <span className="text-muted">solicitudes</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
