/** Lo que ve la propia persona de su cuenta. */
export type MeInfo = {
  uid: string;
  username: string;
  displayName: string;
  createdAt: number; // ms
  email: string;
  emailVerified: boolean;
  admin: boolean;
  plan: "free" | "pro" | "ultra";
};

/** Fila del registro de usuarios que ve un moderador. */
export type UserRow = {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  plan: "free" | "pro" | "ultra";
  createdAt: number;
};
