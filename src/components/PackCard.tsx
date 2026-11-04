import Link from "next/link";
import type { Pack } from "@/lib/types";
import { Img } from "./Img";

export function PackCard({ pack }: { pack: Pack }) {
  return (
    <article className="card flex flex-col gap-3 !p-4 transition hover:border-brand">
      <Link href={`/p/${pack.id}`} className="flex items-center gap-3" aria-label={`Abrir paquete ${pack.title}`}>
        <Img src={pack.trayUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-line bg-surface2 object-contain" />
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{pack.title}</h3>
          <p className="truncate text-xs text-muted">
            por {pack.ownerName || pack.ownerUsername} · {pack.stickers.length} stickers{pack.animated ? " · animado" : ""}
          </p>
        </div>
      </Link>
      <div className="checker grid grid-cols-4 gap-1 overflow-hidden rounded-xl p-1">
        {pack.stickers.slice(0, 4).map((s, i) => (
          <Img key={i} src={s.url} alt="" className="aspect-square w-full object-contain" />
        ))}
      </div>
      <p className="text-xs text-muted">
        {pack.category} · ♥ {pack.favCount} · ↓ {pack.downloadCount}
      </p>
    </article>
  );
}
