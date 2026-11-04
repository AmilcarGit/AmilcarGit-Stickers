export const PLATFORM_NAME = "AmilcarGit-Stickers";

export type Originality = "original" | "third-party";

export const LICENSES = {
  "all-rights-reserved": {
    label: "Todos los derechos reservados",
    description: "Solo el creador decide cómo se usa el sticker.",
  },
  "cc-by": {
    label: "CC BY 4.0",
    description: "Se puede usar y adaptar dando crédito al creador.",
  },
  "cc-by-nc": {
    label: "CC BY-NC 4.0",
    description: "Uso con crédito y sin fines comerciales.",
  },
  cc0: {
    label: "CC0 (dominio público)",
    description: "Sin restricciones; el creador renuncia a sus derechos.",
  },
} as const;

export type LicenseId = keyof typeof LICENSES;

export const METADATA_DISCLAIMER =
  "Esta ficha es informativa. Los metadatos y los créditos no constituyen protección legal de derechos de autor.";

export type CreditsInput = {
  creatorName: string;
  username: string;
  createdAt: Date;
  originality: Originality;
  thirdPartyNote?: string;
  license: LicenseId;
  siteUrl?: string;
};

export type Credits = {
  creator: string;
  username: string;
  platform: string;
  authorship: string;
  date: string;
  originality: Originality;
  thirdPartyNote: string;
  license: LicenseId;
  licenseLabel: string;
  profileUrl: string;
  disclaimer: string;
};

export function buildCredits(input: CreditsInput): Credits {
  const site = (input.siteUrl ?? "").replace(/\/+$/, "");
  return {
    creator: input.creatorName.trim() || input.username,
    username: input.username,
    platform: PLATFORM_NAME,
    authorship: `Creado con ${PLATFORM_NAME}`,
    date: input.createdAt.toISOString().slice(0, 10),
    originality: input.originality,
    thirdPartyNote: input.originality === "third-party" ? (input.thirdPartyNote ?? "").trim() : "",
    license: input.license,
    licenseLabel: LICENSES[input.license].label,
    profileUrl: site ? `${site}/u/${input.username}` : `/u/${input.username}`,
    disclaimer: METADATA_DISCLAIMER,
  };
}

export function creditsToText(c: Credits): string {
  const lines = [
    `CREADOR: ${c.creator}`,
    `WEB: ${c.platform}`,
    `AUTORÍA: ${c.authorship}`,
    `FECHA: ${c.date}`,
    `PERFIL: ${c.profileUrl}`,
    `LICENCIA: ${c.licenseLabel}`,
    `CONTENIDO: ${c.originality === "original" ? "Original del creador" : "Incluye recursos de terceros"}`,
  ];
  if (c.thirdPartyNote) lines.push(`RECURSOS DE TERCEROS: ${c.thirdPartyNote}`);
  lines.push("", c.disclaimer);
  return lines.join("\n");
}
