# AmilcarGit Stickers 👑

Plataforma web para **crear, exportar y compartir stickers 3D y animados para WhatsApp**.
Editor táctil, efecto 3D, animaciones en bucle, exportación WebP validada contra los requisitos de WhatsApp, créditos de autoría, perfiles y comunidad.

## Estado del proyecto (léelo antes de desplegar)

Esta es la **primera versión (v0.1)**. Para ser transparentes sobre qué está probado y qué no:

| Área | Estado |
| --- | --- |
| Reglas de WhatsApp, créditos, historial, validadores, filtros, quitar fondo, ensamblador de WebP animado, lectura de proyectos, límites de uso | ✅ **Probado** con pruebas unitarias (incluido el generador de ZIP) |
| Motor del editor (render 3D, borde, sombra, animación) y exportación | ✅ **Probado en Chromium real**: sticker estático de 31 KB, animado de 18 cuadros y 498 KB que el decodificador del navegador reconoce como animado, con transparencia |
| Lint, tipos, las 56 pruebas y el build de producción | ✅ **GitHub Actions en verde** (workflow `CI`) |
| Páginas, autenticación con Firebase, Firestore, subida a Vercel Blob, rutas `/api/*` | ⚠️ **Compilan, pero aún no se ejecutaron de punta a punta.** Falta probar registro, verificación de correo, recuperación, guardado de proyectos, publicación y descarga con un proyecto real de Firebase y Vercel Blob, y desplegar las reglas de `firestore.rules` |
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
- **Firebase Authentication** (correo y contraseña; verificación y recuperación por correo) y **Firestore** (perfiles, proyectos, paquetes, favoritos, reportes) — plan gratuito *Spark*
- **Vercel Blob** para los archivos publicados (stickers, íconos, fotos de perfil)
- **sharp** en el servidor para validar archivos subidos y convertir PNG→WebP (Safari)
- **jose** para verificar los tokens de Firebase en el servidor, sin Admin SDK
- **Vitest** + **GitHub Actions**

> ¿Por qué no Firebase Storage? Desde 2024 exige el plan de pago (Blaze). Con Vercel Blob los archivos usan la capa gratuita de Vercel.

### Dependencias externas y límites

| Servicio | Para qué | Límite gratuito aproximado* |
| --- | --- | --- |
| Firebase Auth | Cuentas | Uso normal gratuito (plan Spark) |
| Firestore | Datos | 1 GiB almacenados, 50 mil lecturas y 20 mil escrituras por día |
| Vercel Blob | Archivos | Capa gratuita limitada de almacenamiento y transferencia |
| Vercel (Hobby) | Hosting | Uso personal y no comercial |

\* Las cifras cambian: revisa la página de precios de cada servicio antes de lanzar.

## Configuración

### 1. Firebase

1. En la [consola de Firebase](https://console.firebase.google.com) crea un proyecto.
2. **Authentication → Método de acceso →** activa *Correo electrónico/contraseña*.
3. **Authentication → Configuración → Dominios autorizados →** agrega tu dominio de Vercel (y `localhost` para desarrollo).
4. **Authentication → Plantillas →** personaliza el correo de verificación y el de restablecimiento si quieres.
5. **Firestore Database →** crea la base de datos en modo producción.
6. **Firestore → Reglas →** pega el contenido de [`firestore.rules`](./firestore.rules) y publica (o `firebase deploy --only firestore:rules`).
7. **Configuración del proyecto → Tus apps → Web (`</>`)** → copia `apiKey`, `authDomain`, `projectId` y `appId`.

### 2. Vercel

1. Importa el repositorio en Vercel (framework: Next.js; no requiere configuración extra).
2. **Storage → Create → Blob** y conéctalo al proyecto (se crea `BLOB_READ_WRITE_TOKEN` solo).
3. **Settings → Environment Variables:** agrega las variables de `.env.example`:
   `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` y `NEXT_PUBLIC_SITE_URL` (la URL final, p. ej. `https://tu-app.vercel.app`).
4. Despliega.

Las claves `NEXT_PUBLIC_FIREBASE_*` son públicas por diseño; la seguridad la dan las reglas de Firestore y la verificación de tokens en `/api/*`.

### 3. Primer moderador

Para usar `/admin` (revisar reportes y retirar paquetes): en Firestore crea el documento `admins/<UID del usuario>` (puede estar vacío). Desde la app nadie puede escribir en `admins`.

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
    api/upload        sube a Vercel Blob validando token, correo verificado, firma, medidas y peso
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
    data.ts           capa de Firestore
firestore.rules       reglas de seguridad
```

Más detalle en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Seguridad

- Las contraseñas las gestiona Firebase Authentication (nunca se guardan ni se leen en la app).
- Rutas privadas protegidas en el cliente **y** reglas de Firestore que validan dueño, verificación de correo, contadores y moderación.
- `/api/*` verifica el token de Firebase (firma, emisor y audiencia), exige correo verificado para subir, valida el tipo real del archivo (por firma, no por extensión) con medidas y peso, y aplica límite de uso por usuario.
- `/api/zip` solo descarga archivos del dominio de Vercel Blob (evita SSRF).
- Cabeceras de seguridad en `next.config.mjs`; redirecciones `?next=` restringidas a rutas internas.

## Derechos de autor

Cada paquete lleva ficha de autoría (creador, plataforma, fecha, perfil, licencia, si usa recursos de terceros) en la página del paquete, en `CREDITOS.txt` del ZIP y en los datos del proyecto. **No se dibuja ninguna marca dentro del sticker**, y la ficha aclara que los metadatos no son protección legal. Hay reportes por parte de cualquier usuario con sesión y retirada de paquetes tras revisión de un moderador.

## Limitaciones conocidas de esta versión

- Los archivos de un paquete eliminado o retirado **quedan en Vercel Blob** (la app deja de mostrarlos pero no los borra).
- La búsqueda en Explorar filtra en el navegador sobre los 200 paquetes públicos más recientes; con mucha comunidad habrá que pasarla a un servicio de búsqueda.
- Las páginas de paquete y perfil se cargan en el cliente, por lo que no aportan SEO individual todavía.
- Los gestos de pellizco/rotación con dos dedos no existen: el tamaño y la rotación se ajustan con deslizadores (más fiables en pantallas táctiles).
- El nombre de usuario no se puede cambiar después de registrarse.
- No hay eliminación de cuenta desde la interfaz.
- Los contadores (favoritos, descargas) se actualizan desde el cliente y las reglas solo permiten ±1; no son a prueba de manipulación determinada.

## Licencia del código

Pendiente de definir por el autor.
