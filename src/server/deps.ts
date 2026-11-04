import { ConfigError } from "./errors";
import { createMailer, type Mailer } from "./mailer";
import { getStore, type Store } from "./store";

/** Todo lo que necesita la lógica del servidor; en las pruebas se arma a mano. */
export type Deps = {
  store: Store;
  mailer: Mailer;
  siteUrl: string;
  adminEmails: string[];
  secret: string;
  secureCookies: boolean;
};

let cachedMailer: Mailer | null = null;

export function getDeps(): Deps {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) {
    throw new ConfigError("Falta AUTH_SECRET (mínimo 32 caracteres) en las variables de entorno del servidor.");
  }
  cachedMailer ??= createMailer();
  return {
    store: getStore(),
    mailer: cachedMailer,
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
    adminEmails: (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    secret,
    secureCookies: process.env.NODE_ENV === "production",
  };
}
