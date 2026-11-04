# Arquitectura

## Visión general

```
Navegador (Next.js, cliente)            Vercel (serverless, /api/*)              Servicios
┌─────────────────────────────┐ cookie ┌──────────────────────────────┐
│ Editor (canvas 512×512)     │ HttpOnly│ auth: registro, login, sesión│──► Upstash Redis
│ Exportación WebP + mux      │───────►│ proyectos, paquetes, admin   │    (usuarios, sesiones,
│ Páginas y formularios       │        │ /api/upload (sharp)          │     proyectos, paquetes)
└─────────────────────────────┘        │ /api/webp  /api/zip          │──► Vercel Blob (archivos)
                                       │ correo (nodemailer, SMTP)    │──► tu proveedor SMTP
                                       └──────────────────────────────┘
```

La mayor parte del trabajo (editar, renderizar, codificar WebP) ocurre **en el navegador**; el servidor valida, guarda y entrega.

## Decisiones

**Cuentas propias sobre Upstash Redis.** El registro de usuarios vive en una base Redis (Upstash, REST, apta para serverless). Toda la lógica está en `src/server/*` detrás de una interfaz `Store` (`UpstashStore` en producción, `MemoryStore` en pruebas), así se prueba sin red.

**Contraseñas.** `scrypt` (N=16384, r=8, p=1) con sal aleatoria por usuario, comparación en tiempo constante. Nunca se guardan ni se registran en claro; no hay contraseñas en `localStorage`.

**Sesiones.** Token firmado (HMAC-SHA256 con `AUTH_SECRET`) en una cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción, **más** un registro de sesión en Redis (`sess:{id}`): cerrar sesión o cambiar la contraseña lo borra y el token robado deja de servir. Las peticiones que cambian datos comprueban `Origin` (anti-CSRF).

**Unicidad atómica.** Usuario y correo se reservan con `SET NX` (`uname:*`, `uemail:*`), así dos registros simultáneos no pueden tomar el mismo.

**Correo.** Verificación (24 h) y recuperación de contraseña (1 h) usan tokens aleatorios guardados como hash SHA-256 y de un solo uso. Requieren un SMTP (`SMTP_URL`); sin él el registro y el inicio de sesión funcionan, pero no se puede verificar la cuenta (y por tanto no se puede publicar) ni recuperar la contraseña.

**Moderación.** Es moderador quien tenga correo **verificado** incluido en `ADMIN_EMAILS`. Ve los reportes y el registro completo de usuarios (`/admin`).

**Límites de uso** en Redis (`INCR` + `EXPIRE`), por IP, correo o usuario, válidos entre instancias serverless.

**Vercel Blob, no Firebase Storage.** Los archivos publicados van a Blob; el servidor solo acepta URLs de archivos propios del usuario (`/{tipo}s/{uid}/…`) y los borra cuando se elimina el paquete.

**Render del sticker por capas (`SceneRenderer`).** Elementos → silueta oscura desplazada N veces (extrusión 3D) → degradado de luz recortado al sticker → silueta blanca dilatada (borde) → sombra. Todo con canvas 2D, sin WebGL, así funciona igual en Android, iPhone y escritorio.

**Filtros y quitar fondo a mano.** Safari no soporta `ctx.filter`; operar sobre los píxeles es portable. El fondo se borra con relleno por inundación desde los bordes, de modo que los detalles interiores del mismo color se conservan.

**WebP animado ensamblado a mano (`webp-mux.ts`).** Los navegadores solo codifican WebP estático. Cada cuadro se codifica por separado y se unen en un contenedor RIFF con `VP8X` (animación + alfa), `ANIM` (bucle infinito) y un `ANMF` por cuadro. Verificado con el decodificador real de Chromium (`ImageDecoder`).

**Ajuste de peso automático.** Estático: baja la calidad hasta ≤100 KB. Animado: baja la calidad y luego los cuadros por segundo (12→10→8) hasta ≤500 KB.

**Safari.** `canvas.toBlob("image/webp")` devuelve PNG en Safari. `encodeWebp` lo detecta por el tipo del blob y envía el PNG a `/api/webp`, que lo convierte con sharp.

**Un único archivo de reglas de WhatsApp** (`src/lib/whatsapp.ts`). Si WhatsApp cambia sus límites, solo se edita ahí.

## Modelo de datos (Redis)

| Clave | Contenido |
| --- | --- |
| `user:{uid}` | cuenta: perfil, correo, hash de contraseña, verificado, contadores |
| `uname:{usuario}`, `uemail:{correo}` | reservas únicas → `uid` |
| `users` (zset) | registro de usuarios por fecha de alta |
| `sess:{id}`, `usess:{uid}` | sesiones activas y su índice por usuario |
| `verify:{sha256}`, `reset:{sha256}` | tokens de un solo uso con caducidad |
| `project:{id}`, `projects:{uid}` | proyectos del editor (máx. 700 KB cada uno, 30 por usuario) |
| `pack:{id}`, `packs:public`, `packs:owner:{uid}` | paquetes y sus índices |
| `packs:fav`, `packs:dl`, `fav:{uid}` | contadores y favoritos |
| `report:{id}`, `reports:open` | reportes |
| `rl:*` | contadores de límite de uso |

**Límite conocido:** Upstash REST admite cuerpos de ~1 MB; por eso los proyectos tienen tope y las imágenes grandes deben reducirse antes de guardarse. Redis no es una base relacional: las búsquedas se hacen sobre índices propios (zsets) y el filtrado de Explorar ocurre en el navegador.

## Pruebas

Las funciones puras (`src/lib`) y toda la lógica de servidor (`src/server/server.test.ts`, sobre `MemoryStore`) tienen pruebas. El workflow `.github/workflows/ci.yml` ejecuta lint, tipos, pruebas y build en cada push y pull request. Lo que **no** cubre: la conexión real a Upstash, el envío real de correo y Vercel Blob (requieren credenciales).
