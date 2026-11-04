"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Img } from "@/components/Img";
import { PackCard } from "@/components/PackCard";
import { useAuth } from "@/components/Providers";
import { getUserPage } from "@/lib/data";
import type { Pack, UserProfile } from "@/lib/types";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    getUserPage(params.username)
      .then((page) => {
        if (cancelled) return;
        if (!page) return setState("missing");
        setProfile(page.profile);
        setPacks(page.packs);
        setState("ready");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => {
      cancelled = true;
    };
  }, [params.username, loading, user?.uid]);

  if (state === "loading") return <p className="text-muted" role="status">Cargando perfil…</p>;
  if (state === "missing" || !profile) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <h1 className="text-xl font-bold">Perfil no disponible</h1>
        <p className="mt-2 text-muted">Ese usuario no existe o su perfil es privado.</p>
        <Link href="/explore" className="btn-primary mt-4 inline-flex">
          Explorar paquetes
        </Link>
      </div>
    );
  }

  const isOwn = user?.uid === profile.uid;

  return (
    <div className="space-y-8">
      <header className="card flex flex-wrap items-center gap-5">
        {profile.photoURL ? (
          <Img src={profile.photoURL} alt={`Foto de ${profile.displayName}`} className="h-24 w-24 rounded-full border border-line object-cover" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand/30 text-4xl font-bold">{profile.displayName.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">{profile.displayName}</h1>
          <p className="text-muted">@{profile.username}</p>
          {profile.bio && <p className="mt-2 max-w-xl">{profile.bio}</p>}
          <p className="mt-2 text-sm text-muted">
            Creador desde {new Date(profile.createdAt).toLocaleDateString("es", { year: "numeric", month: "long" })} · {profile.packCount} paquetes · {profile.stickerCount} stickers
          </p>
        </div>
        {isOwn && (
          <Link href="/settings" className="btn-ghost">
            Editar perfil
          </Link>
        )}
      </header>

      <section aria-labelledby="paquetes">
        <h2 id="paquetes" className="mb-4 text-xl font-bold">
          Paquetes
        </h2>
        {packs.length === 0 ? (
          <div className="card text-muted">Todavía no hay paquetes publicados.</div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((p) => (
              <li key={p.id}>
                <PackCard pack={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
