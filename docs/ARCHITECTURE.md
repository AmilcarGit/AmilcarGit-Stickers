# Arquitectura

## Visión general

```
Navegador (Next.js)                  Vercel (serverless, /api/*)                 Servicios
┌──────────────────────┐  cookie    ┌────────────────────────────────┐
│ Landing, /endpoints, │  HttpOnly  │ /api/auth, keys, me, admin     │──► Upstash Redis
│ /docs, /dashboard,   │──────────► │ (sesión por cookie)            │    (usuarios, sesiones,
│ /admin, /settings    │            │                                │     claves, cuotas)
└──────────────────────┘            │ /api/v1/*  (clave de API)      │──► iTunes, Jikan, Wikipedia,
Bots y apps ── x-api-key ─────────► │ sticker, search, tools, me     │    Open Library, Openverse, Giphy
                                    │ correo (nodemailer, SMTP)      │──► tu proveedor SMTP
                                    └────────────────────────────────┘
```

## Decisiones

**Cuentas propias sobre Upstash Redis.** Toda la lógica vive en `src/server` y depende de la interfaz `Store` (`UpstashStore` en producción, `MemoryStore` en pruebas), así se prueba sin red.

**Contraseñas.** `scrypt` con sal aleatoria por usuario y comparación en tiempo constante. Nunca se guardan ni se registran en claro.

**Sesiones.** Token firmado (HMAC-SHA256 con `AUTH_SECRET`) en cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción, más un registro de sesión en Redis para poder revocarlas (cerrar sesión o cambiar la contraseña las invalida).

**Unicidad atómica.** Usuario y correo se reservan con `SET NX` (`uname:*`, `uemail:*`).

**Correo.** Verificación (24 h) y recuperación (1 h) con tokens aleatorios guardados como hash SHA-256 y de un solo uso.

**Claves de API.** `amk_` + 24 bytes aleatorios en base64url. Solo se guarda el SHA-256 (`apikey:{hash}`); la clave se muestra una vez. Máximo 5 por cuenta y se exige correo verificado. Se aceptan por `x-api-key`, `Authorization: Bearer` o `?apikey=`.

**Planes y cuotas.** Free/Pro/Ultra con cupo diario (`quota:{uid}:{YYYYMMDD}`, reinicio a medianoche de Lima, UTC-5) y límite por minuto (ventana fija en Redis). Las cabeceras `x-ratelimit-*` informan el estado. El plan lo cambia un administrador.

**Administración.** Es administrador quien tenga correo **verificado** incluido en `ADMIN_EMAILS`.

**Proveedores externos.** `src/server/external.ts` recibe `fetch` inyectado, lo que permite probarlos con respuestas simuladas. Todos usan un `User-Agent` identificable y tiempo de espera.

**Convertidor de stickers.** `sticker-convert.ts` usa sharp: WebP 512×512 transparente, ≤100 KB estático / ≤500 KB animado (ajusta la calidad), entrada máx. 5 MB y ≤60 cuadros. Las constantes salen de `src/lib/whatsapp.ts`.

**Catálogo único de endpoints.** `src/lib/endpoints.ts` alimenta la documentación y el explorador; añadir un endpoint nuevo ahí lo muestra en ambos.

**Handlers.** `route()`/`routeWith()` (`server/http.ts`) para rutas de la web con cookie (comprobación de `Origin`); `v1()`/`v1With()` (`server/v1.ts`) para la API con clave. Los archivos de ruta solo exportan nombres permitidos por Next.

## Modelo de datos (Redis)

| Clave | Contenido |
| --- | --- |
| `user:{uid}` | cuenta: correo, hash de contraseña, verificado, plan |
| `uname:{usuario}`, `uemail:{correo}` | reservas únicas → `uid` |
| `users` (zset) | registro de usuarios por fecha de alta |
| `sess:{id}`, `usess:{uid}` | sesiones activas y su índice por usuario |
| `verify:{sha256}`, `reset:{sha256}` | tokens de un solo uso con caducidad |
| `apikey:{hash}`, `apikeys:{uid}` | claves (solo hash) y su índice por usuario |
| `quota:{uid}:{día}` | contador diario de solicitudes |
| `rl:*` | contadores de límite de uso |

## Pruebas

Funciones puras (`src/lib`) y lógica de servidor (`src/server/*.test.ts`, sobre `MemoryStore` y `fetch` simulado). El workflow `.github/workflows/ci.yml` ejecuta lint, tipos, pruebas y build.
