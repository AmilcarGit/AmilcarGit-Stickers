const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (!USERNAME_RE.test(u)) {
    return "El usuario debe tener de 3 a 20 caracteres: letras minúsculas, números o guion bajo.";
  }
  return null;
}

export function validateEmail(raw: string): string | null {
  return EMAIL_RE.test(raw.trim()) ? null : "Escribe un correo electrónico válido.";
}

export function validatePassword(raw: string): string | null {
  if (raw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Za-z]/.test(raw) || !/\d/.test(raw)) return "Usa letras y al menos un número.";
  return null;
}

/** Solo se aceptan rutas internas, para que /login?next= no pueda llevar a otro sitio. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/dashboard";
  return raw;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Mensajes en español para los códigos de error de Firebase Auth. */
export function authErrorMessage(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.";
    case "auth/invalid-email":
      return "El correo no es válido.";
    case "auth/weak-password":
      return "La contraseña es muy débil.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e inténtalo otra vez.";
    case "auth/network-request-failed":
      return "No hay conexión con el servidor. Revisa tu internet.";
    case "auth/requires-recent-login":
      return "Por seguridad, vuelve a iniciar sesión para hacer este cambio.";
    default:
      return "No se pudo completar la acción. Inténtalo otra vez.";
  }
}
