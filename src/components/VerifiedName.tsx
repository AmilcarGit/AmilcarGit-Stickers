import type { ReactNode } from "react";

type VerifiedBadge = "blue" | "gold" | null | undefined;

export function VerifiedName({ name, badge, className = "" }: { name: ReactNode; badge?: VerifiedBadge; className?: string }) {
  return (
    <span className={"inline-flex min-w-0 items-center gap-1.5 " + className}>
      <span className="min-w-0">{name}</span>
      {badge && (
        <span
          className={"yui-verified-mark yui-verified-" + badge}
          role="img"
          aria-label={badge === "gold" ? "Cuenta verificada dorada por YuiAPI" : "Cuenta verificada azul por YuiAPI"}
          title={badge === "gold" ? "Verificación dorada de YuiAPI" : "Verificación azul de YuiAPI"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2 14.6 4l3.2-.1 1.1 3 2.5 2-1 3.1.5 3.2-2.8 1.6-1.6 2.8-3.2-.5-3.1 1-2-2.5-3-1.1.1-3.2-1.8-2.6 1.8-2.6-.1-3.2 3-1.1 2-2.5 3.1 1z" /><path className="yui-verified-check" d="m8 12.2 2.5 2.5 5.7-5.8" /></svg>
        </span>
      )}
    </span>
  );
}
