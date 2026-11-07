/** Lo que ve la propia persona de su cuenta. */
export type MeInfo = {
  uid: string;
  username: string;
  displayName: string;
  createdAt: number; // ms\n  planExpiresAt?: number | null;
  email: string;
  emailVerified: boolean;
  admin: boolean;
  plan: string;
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
  role: "user" | "moderator" | "admin";\n  planExpiresAt?: number | null;
};
