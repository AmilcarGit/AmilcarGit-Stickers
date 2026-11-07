import type { AdminBadge } from "@/lib/types";

const colors: Record<AdminBadge["color"], string> = {
  gold: "yui-admin-badge-gold",
  blue: "yui-admin-badge-blue",
  purple: "yui-admin-badge-purple",
  pink: "yui-admin-badge-pink",
  green: "yui-admin-badge-green",
  rainbow: "yui-admin-badge-rainbow",
};

export function AdminBadges({ badges, compact = false }: { badges?: AdminBadge[]; compact?: boolean }) {
  if (!badges?.length) return null;
  return (
    <span className="yui-admin-badges" aria-label="Insignias especiales">
      {badges.map((badge) => (
        <span key={badge.id} className={"yui-admin-badge " + colors[badge.color] + (compact ? " is-compact" : "")} title={badge.reason || badge.label}>
          <span aria-hidden="true">{badge.icon}</span>{!compact && <span>{badge.label}</span>}
        </span>
      ))}
    </span>
  );
}
