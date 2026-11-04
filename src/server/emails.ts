import type { Mail } from "./mailer";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function layout(title: string, intro: string, buttonText: string, link: string, footer: string): string {
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1c1438">
<h1 style="font-size:22px">👑 ${esc(title)}</h1>
<p>${esc(intro)}</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#6d28d9;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">${esc(buttonText)}</a></p>
<p style="font-size:13px;color:#625a82">Si el botón no funciona, copia este enlace en tu navegador:<br>${esc(link)}</p>
<p style="font-size:13px;color:#625a82">${esc(footer)}</p></div>`;
}

export function verificationMail(to: string, name: string, link: string): Mail {
  return {
    to,
    subject: "Verifica tu correo · AmilcarGit Stickers",
    text: `Hola ${name}:\n\nConfirma tu correo para poder publicar paquetes:\n${link}\n\nEl enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.`,
    html: layout("Verifica tu correo", `Hola ${name}, confirma tu correo para poder publicar paquetes.`, "Verificar correo", link, "El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje."),
  };
}

export function resetMail(to: string, name: string, link: string): Mail {
  return {
    to,
    subject: "Restablecer tu contraseña · AmilcarGit Stickers",
    text: `Hola ${name}:\n\nPara crear una contraseña nueva abre este enlace:\n${link}\n\nVence en 1 hora. Si no lo pediste, ignora este mensaje: tu contraseña no cambia.`,
    html: layout("Restablecer contraseña", `Hola ${name}, pediste crear una contraseña nueva.`, "Crear contraseña nueva", link, "Vence en 1 hora. Si no lo pediste, ignora este mensaje: tu contraseña no cambia."),
  };
}
