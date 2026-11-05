import type { LicenseId, Originality } from "./credits";

export const CATEGORIES = [
  "Memes",
  "Amor",
  "Animales",
  "Comida",
  "Anime",
  "Gaming",
  "Frases",
  "Deportes",
  "Otros",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type UserProfile = {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  photoURL: string;
  profilePublic: boolean;
  createdAt: number; // ms
  stickerCount: number;
  packCount: number;
};

/** Lo que ve la propia persona de su cuenta. */
export type MeInfo = UserProfile & { email: string; emailVerified: boolean; admin: boolean; plan: "free" | "pro" | "ultra" };

/** Fila del registro de usuarios que ve un moderador. */
export type UserRow = {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  plan: "free" | "pro" | "ultra";
  createdAt: number;
  packCount: number;
  stickerCount: number;
};

export type PackSticker ={ url: string; emojis: string[]; bytes: number };

export type Pack = {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerName: string;
  title: string;
  description: string;
  category: Category;
  tags: string[];
  animated: boolean;
  visibility: "public" | "private";
  listed: boolean;
  status: "active" | "removed";
  license: LicenseId;
  originality: Originality;
  thirdPartyNote: string;
  stickers: PackSticker[];
  trayUrl: string;
  createdAt: number;
  favCount: number;
  downloadCount: number;
};

export type ProjectSummary = {
  id: string;
  name: string;
  thumb: string;
  updatedAt: number;
};

export type ProjectDoc = ProjectSummary & {
  ownerId: string;
  sceneJson: string;
  originality: Originality;
  license: LicenseId;
  thirdPartyNote: string;
  createdAt: number;
};

export const REPORT_REASONS = [
  { id: "copyright", label: "Infringe derechos de autor" },
  { id: "inappropriate", label: "Contenido inapropiado" },
  { id: "spam", label: "Spam o engaño" },
  { id: "other", label: "Otro motivo" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export type Report = {
  id: string;
  packId: string;
  packTitle: string;
  reporterId: string;
  reason: ReportReason;
  details: string;
  status: "open" | "dismissed" | "removed";
  createdAt: number;
};
