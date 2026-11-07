import sharp from "sharp";
import { avatarByUsername, monthlyRanking, removeAvatar, setAvatar, setRankingVisibility } from "./profile";
import { beforeEach, describe, expect, it } from "vitest";
import type { Deps } from "./deps";
import type { Mail } from "./mailer";
import { MemoryStore } from "./memory-store";
import { MAX_KEYS_PER_USER, authenticateApiKey, createApiKey, dayStamp, listApiKeys, nextResetMs, revokeApiKey, setUserPlan } from "./apikeys";
import { hashPassword, verifyPassword } from "./password";
import { clearedCookie, createSession, destroySession, readCookie, readSession, revokeAllSessions, sessionCookie } from "./session";
import { signToken, verifyToken } from "./tokens";
import {
  getUser,
  isAdmin,
  listUsers,
  loginUser,
  registerUser,
  requestReset,
  resendVerification,
  resetPassword,
  saveProfile,
  usernameAvailable,
  verifyEmail,
} from "./users";

const SECRET = "s".repeat(40);
let sent: Mail[] = [];
let store: MemoryStore;
let d: Deps;

function makeDeps(mailerOn = true): Deps {
  return {
    store,
    mailer: {
      configured: mailerOn,
      async send(m) {
        sent.push(m);
      },
    },
    siteUrl: "https://stickers.test",
    adminEmails: ["admin@x.com"],
    secret: SECRET,
    secureCookies: true,
  };
}

const tokenFrom = (m: Mail) => /token=([a-f0-9]+)/.exec(m.text)?.[1] ?? "";
const reg = (over: Partial<{ email: string; username: string; password: string; displayName: string }> = {}) =>
  registerUser(d, { email: "ana@x.com", password: "Segura123", username: "ana", displayName: "Ana", ...over }, "1.1.1.1");

async function rejects(p: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await p;
  } catch (e) {
    const err = e as { status?: number; message: string };
    return { status: err.status ?? 0, message: err.message };
  }
  throw new Error("Se esperaba un error y no ocurrió.");
}

beforeEach(() => {
  sent = [];
  store = new MemoryStore();
  d = makeDeps();
});

describe("tokens de sesión", () => {
  const payload = { sub: "u_1", jti: "j_1", exp: 2_000_000_000 };

  it("firma y verifica", () => {
    expect(verifyToken(SECRET, signToken(SECRET, payload), 1_000)).toEqual(payload);
  });

  it("rechaza firma ajena, manipulación, vencimiento y formato roto", () => {
    const t = signToken(SECRET, payload);
    expect(verifyToken("otra".repeat(10), t, 1_000)).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, sub: "u_admin" })).toString("base64url");
    expect(verifyToken(SECRET, `${forged}.${sig}`, 1_000)).toBeNull();
    expect(verifyToken(SECRET, `${body}.`, 1_000)).toBeNull();
    expect(verifyToken(SECRET, t, 2_000_000_001)).toBeNull();
    expect(verifyToken(SECRET, "basura", 1_000)).toBeNull();
    expect(verifyToken(SECRET, `${t}.extra`, 1_000)).toBeNull();
  });
});

describe("contraseñas", () => {
  it("hash con sal distinta cada vez y verificación correcta", async () => {
    const a = await hashPassword("Segura123");
    const b = await hashPassword("Segura123");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a).not.toContain("Segura123");
    expect(await verifyPassword("Segura123", a)).toBe(true);
    expect(await verifyPassword("segura123", a)).toBe(false);
    expect(await verifyPassword("x", "formato-roto")).toBe(false);
  });
});

describe("cookies de sesión", () => {
  it("lee la cookie correcta entre varias", () => {
    expect(readCookie("a=1; sid=abc.def; b=2", "sid")).toBe("abc.def");
    expect(readCookie(null, "sid")).toBeNull();
    expect(readCookie("xsid=1", "sid")).toBeNull();
  });

  it("la cookie es HttpOnly, SameSite=Lax y Secure en producción", () => {
    const c = sessionCookie("tok", 100, true);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
    expect(sessionCookie("tok", 100, false)).not.toContain("Secure");
    expect(clearedCookie(true)).toContain("Max-Age=0");
  });

  it("crear, leer, cerrar y revocar sesiones", async () => {
    const s1 = await createSession(d, "u_1");
    const s2 = await createSession(d, "u_1");
    const req = (tok: string) => new Request("https://x.test/", { headers: { cookie: `sid=${tok}` } });
    const r1 = await readSession(d, req(s1.token));
    expect(r1?.uid).toBe("u_1");
    expect(await readSession(d, new Request("https://x.test/"))).toBeNull();
    await destroySession(d, "u_1", r1!.jti);
    expect(await readSession(d, req(s1.token))).toBeNull();
    expect((await readSession(d, req(s2.token)))?.uid).toBe("u_1");
    await revokeAllSessions(d, "u_1");
    expect(await readSession(d, req(s2.token))).toBeNull();
  });
});

describe("registro", () => {
  it("crea la cuenta, guarda hash (no la contraseña) y envía verificación", async () => {
    const { user, emailSent } = await reg();
    expect(emailSent).toBe(true);
    expect(user.emailVerified).toBe(false);
    expect(user.passHash).not.toContain("Segura123");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ana@x.com");
    expect(sent[0].text).toContain("https://stickers.test/verify?token=");
    expect(await usernameAvailable(d, "ana")).toBe(false);
    expect(await usernameAvailable(d, "otra")).toBe(true);
    expect((await listUsers(d, 0, 10)).total).toBe(1);
  });

  it("normaliza correo y usuario, y rechaza duplicados sin dejar reservas colgadas", async () => {
    await reg({ email: "Ana@X.com", username: "@Ana" });
    expect((await rejects(reg({ email: "otra@x.com" }))).status).toBe(409);
    const dupMail = await rejects(reg({ username: "nueva", email: "ANA@x.com" }));
    expect(dupMail.status).toBe(409);
    expect(await usernameAvailable(d, "nueva")).toBe(true);
  });

  it("valida datos", async () => {
    expect((await rejects(reg({ email: "mal" }))).status).toBe(400);
    expect((await rejects(reg({ username: "a" }))).status).toBe(400);
    expect((await rejects(reg({ password: "corta1" }))).status).toBe(400);
    expect((await rejects(reg({ password: "a1".repeat(150) }))).status).toBe(400);
  });

  it("funciona sin correo configurado, sin enviar nada", async () => {
    d = makeDeps(false);
    const { emailSent } = await reg();
    expect(emailSent).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("limita los registros por conexión", async () => {
    for (let i = 0; i < 10; i++) await registerUser(d, { email: `u${i}@x.com`, password: "Segura123", username: `user${i}`, displayName: "" }, "9.9.9.9");
    expect((await rejects(registerUser(d, { email: "z@x.com", password: "Segura123", username: "zeta", displayName: "" }, "9.9.9.9"))).status).toBe(429);
  });
});

describe("inicio de sesión", () => {
  it("acepta credenciales correctas y rechaza incorrectas con el mismo mensaje", async () => {
    await reg();
    expect((await loginUser(d, { email: "ANA@x.com", password: "Segura123" }, "2.2.2.2")).username).toBe("ana");
    const bad = await rejects(loginUser(d, { email: "ana@x.com", password: "Equivocada1" }, "2.2.2.2"));
    const ghost = await rejects(loginUser(d, { email: "nadie@x.com", password: "Segura123" }, "2.2.2.2"));
    expect(bad.status).toBe(401);
    expect(ghost).toEqual(bad);
  });

  it("bloquea tras demasiados intentos fallidos con el mismo correo", async () => {
    await reg();
    for (let i = 0; i < 8; i++) expect((await rejects(loginUser(d, { email: "ana@x.com", password: "mala" }, `3.3.3.${i}`))).status).toBe(401);
    expect((await rejects(loginUser(d, { email: "ana@x.com", password: "Segura123" }, "3.3.3.99"))).status).toBe(429);
  });
});

describe("verificación y recuperación", () => {
  it("el enlace de verificación sirve una sola vez", async () => {
    const { user } = await reg();
    const token = tokenFrom(sent[0]);
    await verifyEmail(d, token);
    expect((await getUser(d, user.uid))?.emailVerified).toBe(true);
    expect((await rejects(verifyEmail(d, token))).status).toBe(400);
    expect((await rejects(verifyEmail(d, "inventado"))).status).toBe(400);
  });

  it("el enlace vence a las 24 horas", async () => {
    let now = 1_000_000;
    store = new MemoryStore(() => now);
    d = makeDeps();
    await reg();
    now += 25 * 3600 * 1000;
    expect((await rejects(verifyEmail(d, tokenFrom(sent[0])))).status).toBe(400);
  });

  it("reenviar verificación manda otro correo y se limita", async () => {
    const { user } = await reg();
    await resendVerification(d, user.uid);
    expect(sent).toHaveLength(2);
    for (let i = 0; i < 4; i++) await resendVerification(d, user.uid);
    expect((await rejects(resendVerification(d, user.uid))).status).toBe(429);
  });

  it("recuperar contraseña cambia la clave, verifica el correo y cierra las sesiones", async () => {
    const { user } = await reg();
    const session = await createSession(d, user.uid);
    sent = [];
    await requestReset(d, "ana@x.com", "4.4.4.4");
    expect(sent).toHaveLength(1);
    const token = tokenFrom(sent[0]);
    expect((await rejects(resetPassword(d, token, "corta"))).status).toBe(400);
    await resetPassword(d, token, "NuevaClave9");
    expect((await getUser(d, user.uid))?.emailVerified).toBe(true);
    expect((await loginUser(d, { email: "ana@x.com", password: "NuevaClave9" }, "4.4.4.4")).uid).toBe(user.uid);
    expect((await rejects(loginUser(d, { email: "ana@x.com", password: "Segura123" }, "4.4.4.4"))).status).toBe(401);
    expect(await readSession(d, new Request("https://x.test/", { headers: { cookie: `sid=${session.token}` } }))).toBeNull();
    expect((await rejects(resetPassword(d, token, "OtraClave88"))).status).toBe(400);
  });

  it("no revela si el correo existe", async () => {
    await requestReset(d, "nadie@x.com", "5.5.5.5");
    expect(sent).toHaveLength(0);
  });

  it("sin correo configurado avisa con 503", async () => {
    d = makeDeps(false);
    expect((await rejects(requestReset(d, "ana@x.com", "6.6.6.6"))).status).toBe(503);
  });
});

describe("perfil y moderación", () => {
  it("edita el nombre visible y respeta el límite", async () => {
    const { user } = await reg();
    expect((await saveProfile(d, user.uid, { displayName: "  Ana María " })).displayName).toBe("Ana María");
    expect((await saveProfile(d, user.uid, { displayName: "x".repeat(200) })).displayName).toHaveLength(60);
  });

  it("solo es moderador quien tiene correo verificado y figura en ADMIN_EMAILS", async () => {
    const { user } = await reg({ email: "admin@x.com", username: "root" });
    expect(isAdmin(d, user)).toBe(false);
    expect(isAdmin(d, { ...user, emailVerified: true })).toBe(true);
    expect(isAdmin(d, { ...user, emailVerified: true, email: "otro@x.com" })).toBe(false);
  });
});

describe("registro de usuarios para moderación", () => {
  it("lista a todos los usuarios, del más reciente al más antiguo, con paginación", async () => {
    for (let i = 0; i < 5; i++) {
      await registerUser(d, { email: `u${i}@x.com`, password: "Segura123", username: `user${i}`, displayName: "" }, `10.0.0.${i}`);
      await new Promise((r) => setTimeout(r, 2));
    }
    const first = await listUsers(d, 0, 2);
    expect(first.total).toBe(5);
    expect(first.users.map((u) => u.username)).toEqual(["user4", "user3"]);
    expect((await listUsers(d, 4, 10)).users.map((u) => u.username)).toEqual(["user0"]);
    expect(JSON.stringify(first)).not.toContain("passHash");
  });
});

describe("claves de API y cuotas", () => {
  beforeEach(() => {
    store = new MemoryStore();
    d = makeDeps();
    sent = [];
  });

  async function verifiedUser() {
    const { user } = await reg();
    await verifyEmail(d, tokenFrom(sent[0]));
    return (await getUser(d, user.uid))!;
  }

  it("crea una clave que solo se muestra una vez y se guarda como hash", async () => {
    const u = await verifiedUser();
    const { key, info } = await createApiKey(d, u, "Mi bot");
    expect(key.startsWith("amk_")).toBe(true);
    expect(key.length).toBeGreaterThanOrEqual(30);
    expect(info.prefix).toBe(key.slice(0, 8));
    const listed = await listApiKeys(d, u.uid);
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(key);
    expect(JSON.stringify(await store.zrange(`apikeys:${u.uid}`, 0, -1))).not.toContain(key);
  });

  it("exige correo verificado, nombre y respeta el máximo de claves", async () => {
    const u = await verifiedUser();
    const { user: sinVerificar } = await reg({ email: "bob@x.com", username: "bob" });
    expect((await rejects(createApiKey(d, sinVerificar, "x"))).status).toBe(403);
    expect((await rejects(createApiKey(d, u, "  "))).status).toBe(400);
    for (let i = 0; i < MAX_KEYS_PER_USER; i++) await createApiKey(d, u, `k${i}`);
    expect((await rejects(createApiKey(d, u, "una más"))).status).toBe(403);
  });

  it("autentica con la clave, descuenta cuota y rechaza claves malas o revocadas", async () => {
    const u = await verifiedUser();
    const { key, info } = await createApiKey(d, u, "bot");
    const a = await authenticateApiKey(d, key);
    expect(a.user.uid).toBe(u.uid);
    expect(a.quota).toMatchObject({ plan: "free", limit: 100, used: 1, remaining: 99 });
    expect((await authenticateApiKey(d, key)).quota.remaining).toBe(98);
    expect((await rejects(authenticateApiKey(d, null))).status).toBe(401);
    expect((await rejects(authenticateApiKey(d, "amk_" + "x".repeat(32)))).status).toBe(401);
    expect((await rejects(authenticateApiKey(d, "otra-cosa"))).status).toBe(401);
    await revokeApiKey(d, u.uid, info.id);
    expect((await rejects(authenticateApiKey(d, key))).status).toBe(401);
    expect((await rejects(revokeApiKey(d, u.uid, info.id))).status).toBe(404);
  });

  it("no deja revocar la clave de otra persona", async () => {
    const u = await verifiedUser();
    const { info } = await createApiKey(d, u, "bot");
    expect((await rejects(revokeApiKey(d, "u_otro", info.id))).status).toBe(404);
    expect(await listApiKeys(d, u.uid)).toHaveLength(1);
  });

  it("aplica el límite por minuto y la cuota diaria, que se reinicia a medianoche de Lima", async () => {
    const u = await verifiedUser();
    const { key } = await createApiKey(d, u, "bot");
    const t0 = Date.UTC(2026, 10, 5, 12, 0, 0); // 07:00 en Lima
    // 30 por minuto en el plan free
    for (let i = 0; i < 30; i++) await authenticateApiKey(d, key, t0);
    const minute = await rejects(authenticateApiKey(d, key, t0));
    expect(minute.status).toBe(429);
    expect(minute.message).toContain("minuto");
    // cuota diaria: se simula alcanzar el tope
    await store.set(`quota:${u.uid}:${dayStamp(t0)}`, 100);
    await store.del(`rl:api:${u.uid}`);
    const day = await rejects(authenticateApiKey(d, key, t0));
    expect(day.status).toBe(429);
    expect(day.message).toContain("hoy");
    // pasada la medianoche de Lima (05:00 UTC) vuelve a haber cuota
    const next = nextResetMs(t0);
    expect(new Date(next).toISOString()).toBe("2026-11-06T05:00:00.000Z");
    await store.del(`rl:api:${u.uid}`);
    expect((await authenticateApiKey(d, key, next + 1000)).quota.used).toBe(1);
  });

  it("el plan cambia los límites y solo acepta planes válidos", async () => {
    const u = await verifiedUser();
    await setUserPlan(d, u.uid, "pro");
    const { key } = await createApiKey(d, (await getUser(d, u.uid))!, "bot");
    expect((await authenticateApiKey(d, key)).quota).toMatchObject({ plan: "pro", limit: 2000 });
    expect((await rejects(setUserPlan(d, u.uid, "gratis-total"))).status).toBe(400);
    expect((await rejects(setUserPlan(d, "u_nadie", "pro"))).status).toBe(404);
  });
});

describe("foto de perfil y ranking", () => {
  beforeEach(() => {
    store = new MemoryStore();
    d = makeDeps();
    sent = [];
  });

  const png = (w = 600, h = 300) => sharp({ create: { width: w, height: h, channels: 3, background: "#f472b6" } }).png().toBuffer();

  it("recorta la foto a 256x256 WebP y se sirve por usuario", async () => {
    const { user } = await reg();
    const next = await setAvatar(d, user.uid, new Uint8Array(await png()), 5_000);
    expect(next.avatarV).toBe(5_000);
    const bytes = await avatarByUsername(d, "ANA");
    expect(bytes).not.toBeNull();
    const meta = await sharp(Buffer.from(bytes!)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);
    expect(await avatarByUsername(d, "nadie")).toBeNull();
  });

  it("rechaza archivos que no son imagen, vacíos o muy pesados", async () => {
    const { user } = await reg();
    expect((await rejects(setAvatar(d, user.uid, new TextEncoder().encode("hola")))).status).toBe(400);
    expect((await rejects(setAvatar(d, user.uid, new Uint8Array(0)))).status).toBe(400);
    expect((await rejects(setAvatar(d, user.uid, new Uint8Array(2 * 1024 * 1024 + 1)))).status).toBe(413);
  });

  it("quita la foto", async () => {
    const { user } = await reg();
    await setAvatar(d, user.uid, new Uint8Array(await png()));
    expect((await removeAvatar(d, user.uid)).avatarV).toBe(0);
    expect(await avatarByUsername(d, "ana")).toBeNull();
  });

  async function keyFor(email: string, username: string) {
    const { user } = await reg({ email, username });
    await verifyEmail(d, tokenFrom(sent[sent.length - 1]));
    return { uid: user.uid, key: (await createApiKey(d, (await getUser(d, user.uid))!, "bot")).key };
  }

  it("cuenta solo solicitudes exitosas y ordena de mayor a menor", async () => {
    const a = await keyFor("ana@x.com", "ana");
    const b = await keyFor("bea@x.com", "bea");
    const now = Date.UTC(2026, 10, 15, 12);
    for (let i = 0; i < 3; i++) await authenticateApiKey(d, a.key, now);
    for (let i = 0; i < 5; i++) await authenticateApiKey(d, b.key, now);
    await rejects(authenticateApiKey(d, "amk_clave_falsa_clave_falsa_clave", now));
    const r = await monthlyRanking(d, now);
    expect(r.month).toBe("2026-11");
    expect(r.entries.map((e) => [e.rank, e.username, e.count])).toEqual([
      [1, "bea", 5],
      [2, "ana", 3],
    ]);
    expect(JSON.stringify(r)).not.toContain("@x.com");
    expect(JSON.stringify(r)).not.toContain(a.uid);
  });

  it("respeta quién no quiere salir y no mezcla meses", async () => {
    const a = await keyFor("ana@x.com", "ana");
    const b = await keyFor("bea@x.com", "bea");
    const now = Date.UTC(2026, 10, 15, 12);
    await authenticateApiKey(d, a.key, now);
    await authenticateApiKey(d, b.key, now);
    await setRankingVisibility(d, b.uid, false);
    expect((await monthlyRanking(d, now)).entries.map((e) => e.username)).toEqual(["ana"]);
    expect((await monthlyRanking(d, Date.UTC(2026, 11, 2, 12))).entries).toEqual([]);
  });
});
