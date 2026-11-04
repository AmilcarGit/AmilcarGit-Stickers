# AmilcarGit Stickers 👑

Plataforma web para **crear, exportar y compartir stickers 3D y animados para WhatsApp**.
Editor táctil, efecto 3D, animaciones en bucle, exportación WebP validada contra los requisitos de WhatsApp, créditos de autoría, perfiles y comunidad.

## Estado del proyecto (léelo antes de desplegar)

Esta es la **versión v0.2** (cuentas propias sobre Upstash Redis). Para ser transparentes sobre qué está probado y qué no:

| Área | Estado |
| --- | --- |
| Reglas de WhatsApp, créditos, historial, validadores, filtros, quitar fondo, ensamblador de WebP animado, lectura de proyectos, límites de uso | ✅ **Probado** con pruebas unitarias (incluido el generador de ZIP) |
| Motor del editor (render 3D, borde, sombra, animación) y exportación | ✅ **Probado en Chromium real**: sticker estático de 31 KB, animado de 18 cuadros y 498 KB que el decodificador del navegador reconoce como animado, con transparencia |
| Lógica de cuentas y datos (registro, contraseñas, sesiones, verificación, recuperación, proyectos, paquetes, favoritos, reportes, registro de usuarios) | ✅ **Probada** con pruebas unitarias sobre una base en memoria (35 pruebas) |
| Lint, tipos, pruebas y build de producción | Se verifican en **GitHub Actions** (workflow `CI`); revisa el estado del último push |
| Conexión real a Upstash, envío real de correo, subida a Vercel Blob, rutas `/api/*` de punta a punta | ⚠️ **Aún no probado con servicios reales.** Falta registrar un usuario, verificar el correo, recuperar contraseña, guardar, publicar y descargar en un despliegue real |
| Exportación en Safari / iPhone | ⚠️ Safari no sabe codificar WebP en canvas; el código usa un convertidor en el servidor (`/api/webp`). **Sin probar en un iPhone real** |
| Diseño móvil, accesibilidad, despliegue en Vercel | ⚠️ Pendiente de probar en dispositivos reales |

## Lo que sí y lo que no puede hacer con WhatsApp

WhatsApp **no permite instalar paquetes de stickers desde una página web**: eso exige una app nativa. Por eso la plataforma:

- genera stickers **WebP 512×512, fondo transparente, ≤100 KB (estáticos) o ≤500 KB (animados)**, con ícono de paquete 96×96, de 3 a 30 stickers por paquete y de 1 a 3 emojis por sticker (los límites vienen del [README oficial de WhatsApp/stickers](https://github.com/WhatsApp/stickers/blob/main/Android/README.md), verificados el 2026-11-03 y centralizados en `src/lib/whatsapp.ts`);
- entrega un **ZIP** con los WebP, `tray.png`, `pack.json`, `CREDITOS.txt` y `LEEME.txt`;
- para agregarlos a WhatsApp, la persona los importa con una app de paquetes de stickers (instrucciones en `LEEME.txt`).

Un GIF **no** se usa como formato final: los animados se exportan como WebP animado.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS**, desplegado en **Vercel**
- **Upstash Redis** (REST) como base de datos: usuarios, sesiones, proyectos, paquetes, favoritos, reportes
- **Cuentas propias:** contraseñas con `scrypt`, sesiones en cookie `HttpOnly` firmada, verificación y recuperación por correo (**nodemailer** + un SMTP a tu elección)
- **Vercel Blob** para los archivos publicados (stickers, íconos, fotos de perfil)
- **sharp** en el servidor para validar archivos subidos y convertir PNG→WebP (Safari)
- **Vitest** + **GitHub Actions**

### Dependencias externas y límites

| Servicio | Para qué | Notas |
| --- | --- | --- |
| Upstash Redis | Todos los datos | Capa gratuita con límite de comandos/día y de tamaño; revisa su página de precios. Redis no es relacional |
| Proveedor SMTP | Correos de verificación y recuperación | **Obligatorio** para verificar cuentas y publicar. Puede ser Gmail con contraseña de aplicación, Brevo, Resend (SMTP), etc. |
| Vercel Blob | Archivos | Capa gratuita limitada |
| Vercel (Hobby) | Hosting | Uso personal y no comercial |

## Configuración

### 1. Upstash Redis

1. Crea una base en [Upstash](https://console.upstash.com) → copia **REST URL** y **REST Token**.
2. Guárdalos **solo** como variables de entorno en Vercel (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). **Nunca** los pegues en el repositorio ni en chats; si se filtran, rota el token en Upstash.

### 2. Vercel

1. Importa el repositorio (Next.js, sin configuración extra).
2. **Storage → Create → Blob** y conéctalo (crea `BLOB_READ_WRITE_TOKEN`).
3. **Settings → Environment Variables** (ver `.env.example`): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `AUTH_SECRET` (32+ caracteres aleatorios), `ADMIN_EMAILS`, `SMTP_URL`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL` (URL final).
4. Despliega.

### 3. Primer moderador

Registra tu cuenta con un correo que figure en `ADMIN_EMAILS`, verifícalo y aparecerá «Moderación» en el menú: reportes y **registro completo de usuarios**.

### 4. Desarrollo local

```bash
cp .env.example .env.local   # completa las variables
npm install
npm run dev                  # http://localhost:3000
```

Scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Cómo está organizado

```
src/
  app/                páginas (App Router) y rutas /api
    api/auth, me, projects, packs, users, reports, admin   API propia (sesión por cookie)
    api/upload        sube a Vercel Blob validando sesión, correo verificado, firma, medidas y peso
    api/webp          convierte PNG→WebP (solo navegadores que no lo codifican)
    api/zip           arma el ZIP de un paquete público (solo descarga de nuestro Blob)
    editor, pack/new, explore, p/[id], u/[username], dashboard, settings, admin, legal
  components/         Header, Providers (sesión + avisos), Guards, StickerEditor, PackCard…
  lib/
    whatsapp.ts       requisitos y validación de stickers y paquetes
    scene.ts          modelo del sticker, animaciones, render 3D (extrusión, luz, borde, sombra)
    image-ops.ts      quitar fondo y filtros (a mano: Safari no soporta ctx.filter)
    webp-mux.ts       ensamblador de WebP animado (RIFF/VP8X/ANIM/ANMF)
    export.ts         exportación estática/animada con ajuste de peso
    credits.ts        ficha de autoría y licencias
    data.ts, api.ts   cliente de la API propia
  server/             cuentas, sesiones, Redis, correo, proyectos, paquetes, reportes (con pruebas)
```

Más detalle en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Seguridad

- Contraseñas con `scrypt` y sal por usuario; nunca en claro, nunca en `localStorage`.
- Sesión en cookie `HttpOnly` + registro en Redis: cerrar sesión o cambiar la contraseña invalida los tokens.
- Inicio de sesión y registro con límite de intentos y respuesta de tiempo parejo (no revela si un correo existe); la recuperación responde igual exista o no la cuenta.
- Comprobación de `Origin` en toda petición que modifica datos (CSRF).
- `/api/upload` exige sesión y correo verificado, valida el tipo real del archivo (firma), medidas y peso; el servidor solo acepta URLs de archivos propios del usuario.
- `/api/zip` solo descarga archivos del dominio de Vercel Blob (evita SSRF).
- Cabeceras de seguridad en `next.config.mjs`; redirecciones `?next=` restringidas a rutas internas.
- Moderadores: solo correos verificados listados en `ADMIN_EMAILS`.

## Derechos de autor

Cada paquete lleva ficha de autoría (creador, plataforma, fecha, perfil, licencia, si usa recursos de terceros) en la página del paquete, en `CREDITOS.txt` del ZIP y en los datos del proyecto. **No se dibuja ninguna marca dentro del sticker**, y la ficha aclara que los metadatos no son protección legal. Hay reportes por parte de cualquier usuario con sesión y retirada de paquetes tras revisión de un moderador.

## Limitaciones conocidas de esta versión

- Al **eliminar** un paquete se borran sus archivos de Vercel Blob; al **retirarlo** por moderación se conservan (se oculta, no se borra) para poder revisarlo.
- Sin `SMTP_URL` no hay verificación de correo ni recuperación de contraseña, y por tanto nadie puede publicar.
- Los proyectos guardados tienen tope de ~700 KB por límites de Upstash REST.
- La búsqueda en Explorar filtra en el navegador sobre los 200 paquetes públicos más recientes; con mucha comunidad habrá que pasarla a un servicio de búsqueda.
- Las páginas de paquete y perfil se cargan en el cliente, por lo que no aportan SEO individual todavía.
- Los gestos de pellizco/rotación con dos dedos no existen: el tamaño y la rotación se ajustan con deslizadores (más fiables en pantallas táctiles).
- El nombre de usuario no se puede cambiar después de registrarse.
- Las descargas se cuentan con límite por conexión; no son a prueba de manipulación determinada.
- No hay cambio de correo ni eliminación de cuenta desde la interfaz.

## Licencia del código

Pendiente de definir por el autor.
