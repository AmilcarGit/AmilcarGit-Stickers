"use client";

import { useState } from "react";

/** Foto de perfil con respaldo a la inicial si no hay foto o falla la carga. */
export function Avatar({ username, name, v, size = 36 }: { username: string; name: string; v: number; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || username || "?").slice(0, 1).toUpperCase();
  if (!v || failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-brand/30 font-bold"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/avatar/${encodeURIComponent(username)}?v=${v}`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
