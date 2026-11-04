import nodemailer from "nodemailer";
import { ConfigError } from "./errors";

export type Mail = { to: string; subject: string; text: string; html?: string };
export type Mailer = { configured: boolean; send(mail: Mail): Promise<void> };

/**
 * Envío de correos por SMTP (Gmail con contraseña de aplicación, Brevo, Resend SMTP, etc.).
 * Se configura con SMTP_URL (ej. smtps://usuario:clave@smtp.gmail.com:465) y EMAIL_FROM.
 * Sin esas variables la app funciona, pero no puede verificar correos ni recuperar contraseñas.
 */
export function createMailer(): Mailer {
  const url = process.env.SMTP_URL;
  const from = process.env.EMAIL_FROM;
  if (!url || !from) {
    return {
      configured: false,
      async send() {
        throw new ConfigError("El envío de correos no está configurado en el servidor.");
      },
    };
  }
  const transport = nodemailer.createTransport(url);
  return {
    configured: true,
    async send(mail) {
      await transport.sendMail({ from, ...mail });
    },
  };
}
