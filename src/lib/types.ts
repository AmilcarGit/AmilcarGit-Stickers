export type AdminBadge = { id: string; label: string; icon: string; color: "gold" | "blue" | "purple" | "pink" | "green" | "rainbow"; reason?: string; awardedAt: number; awardedBy: string };

/** Lo que ve la propia persona de su cuenta. */
export type MeInfo = {
  uid: string;
  username: string;
  displayName: string;
  verifiedBadge?: "blue" | "gold" | null;
  adminBadges?: AdminBadge[];
  createdAt: number; // ms
  planExpiresAt?: number | null;
  email: string;
  emailVerified: boolean;
  admin: boolean;
  plan: string;
  /** 0 = sin foto; si no, versión para refrescar la caché. */
  avatarV: number;
  showInRanking: boolean;
  bio?: string;
  location?: string;
};

/** Fila del registro de usuarios que ve un moderador. */
export type UserRow = {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  plan: string;
  createdAt: number;
  status: "active" | "suspended";
  dailyLimit: number | null;
  minuteLimit: number | null;
  role: "user" | "moderator" | "admin";
  verifiedBadge?: "blue" | "gold" | null;
  adminBadges?: AdminBadge[];
  planExpiresAt?: number | null;
};

/** Una fila del ranking público de uso mensual. */
export type RankingEntry = { rank: number; username: string; displayName: string; verifiedBadge?: "blue" | "gold" | null; adminBadges?: AdminBadge[]; count: number; avatarV: number };
