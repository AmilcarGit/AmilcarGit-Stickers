# YuiApi 🌸

API pública con clave gratuita: **búsqueda en fuentes abiertas, conversión de stickers para WhatsApp y herramientas**, con interfaz web (landing, explorador de endpoints, documentación, panel de claves y administración) en estilo rosa sakura y lavanda.

Producción: <https://yuiapi.vercel.app>

## Estado (léelo antes de desplegar)

| Área | Estado |
| --- | --- |
| Cuentas (registro, contraseñas, sesiones, verificación y recuperación), claves de API, cuotas y planes | ✅ Pruebas unitarias sobre una base en memoria |
| Conversión de stickers, herramientas (QR, hash, UUID, Base64, contraseña), proveedores externos | ✅ Pruebas automáticas (los proveedores con respuestas simuladas) |
| Lint, tipos, pruebas y build | Se verifican en **GitHub Actions** (workflow `CI`) |
| Conexión real a Upstash, correo real, proveedores externos reales (iTunes, Jikan, Wikipedia, Open Library, Openverse, Giphy) y un bot de WhatsApp real | ⚠️ **Sin probar de punta a punta.** Prueba con tu clave en `/endpoints` |
| Diseño móvil y accesibilidad en dispositivos reales | ⚠️ Pendiente |

## Qué ofrece

- **Stickers:** `POST /api/v1/sticker` convierte una imagen o GIF en WebP 512×512 transparente dentro del peso de WhatsApp (≤100 KB estático, ≤500 KB animado); `GET /api/v1/sticker/search` busca en Giphy (requiere tu propia `GIPHY_API_KEY`; hay que mostrar «Powered by GIPHY»).
- **Búsqueda:** música (Apple iTunes Search, fragmento oficial de 30 s), anime (Jikan), Wikipedia, libros (Open Library), imágenes con licencia abierta (Openverse), YouTube y Pinterest.
- **Dragon Ball:** `GET /api/v1/dragonball/characters?q=Goku`, `/character?id=1`, `/planets` y `/random`. Usa Dragon Ball API comunitaria; no es un servicio oficial de Toei.
- **Entretenimiento:** `GET /api/v1/random/anime`, `meme`, `wallpaper`, `waifu`, `quote`, `fact`, `joke` y `cosplay`. Las imágenes de Openverse incluyen autor/licencia cuando el proveedor los devuelve; las frases, datos y chistes son una colección propia.
- **Herramientas:** QR, hash, UUID, Base64, contraseñas.
- **Claves:** `amk_…`, guardadas solo como hash SHA-256 y mostradas una vez; máx. 5 por cuenta y correo verificado. Planes Free (100/día, 30/min), Pro (2 000/día, 120/min), Ultra (10 000/día, 300/min); reinicio a medianoche de Lima. Los cambia un administrador desde `/admin`. **No hay cobros implementados.**
- **Perfil y ranking:** cada persona puede subir una foto (se recorta a 256×256 WebP y se guarda en Redis, máx. 2 MB). `/ranking` muestra el top 10 del mes por solicitudes exitosas (hora de Lima); se puede salir del ranking desde Mi cuenta y nunca expone correo.
- **Qué NO incluye, a propósito:** descargas de YouTube, Spotify, Apple Music, TikTok o similares (violan sus términos y derechos de autor).

La clave se envía en `x-api-key`, `Authorization: Bearer …` o `?apikey=` (evítalo en URLs). Respuestas `{ ok: true, … }` / `{ ok: false, error }`, con cabeceras `x-ratelimit-*` y CORS abierto.

## Developer Studio

La ruta `/developer` incorpora un espacio de trabajo para probar los endpoints del catálogo real de YuiAPI.

- **Request Builder:** ejecuta solicitudes GET y POST, incluyendo los endpoints que reciben archivos, y muestra código HTTP, duración y respuesta.
- **Historial y colecciones locales:** conserva hasta 20 ejecuciones y 50 solicitudes guardadas en el navegador. No sincroniza estos datos entre dispositivos y nunca guarda la API Key.
- **Generador de ejemplos:** crea snippets de JavaScript, Python y cURL desde el endpoint seleccionado. Son plantillas de integración, no paquetes SDK publicados.
- **OpenAPI:** `GET /api/openapi` genera la especificación OpenAPI 3.1 desde `src/lib/endpoints.ts`.
- **Gestión de claves:** las rutas autenticadas permiten rotar una clave, ajustar límites por clave y consultar su uso diario:
  - `POST /api/keys/{id}/rotate`
  - `PATCH /api/keys/{id}/limits`
  - `GET /api/keys/{id}/usage`
- **Monitor manual:** el Request Builder permite comprobar un endpoint cuando el desarrollador ejecuta una solicitud. No es un monitor programado ni una garantía de disponibilidad.
- **Seguridad y métricas existentes:** se reutilizan el Security Center de administración y las estadísticas de uso que ya ofrece la aplicación.

> **Alcance:** el envío automático de webhooks, la analítica global persistente y los SDK publicados como paquetes independientes requieren componentes adicionales y no se presentan como funciones terminadas en esta entrega.


## YuiAPI AI Ecosystem

**YuiAPI AI Ecosystem** es la iniciativa para convertir YuiAPI en un centro de conocimiento y creación de herramientas para desarrolladores de bots. Su objetivo es que asistentes como Claude y otros agentes compatibles puedan consultar documentación técnica, entender distintos frameworks y ayudar a generar comandos adaptados a la estructura real de cada proyecto.

> **Estado:** proyecto planificado. Las funciones descritas en esta sección son objetivos de desarrollo; no forman parte todavía de la API disponible en producción.

### Objetivos

- **Yui Assistant:** asistente integrado en la plataforma para orientar a los desarrolladores y ayudarles a construir comandos.
- **YuiAPI MCP Server:** interfaz basada en Model Context Protocol (MCP) para que clientes compatibles, como Claude, puedan consultar herramientas y documentación de YuiAPI.
- **Knowledge Hub:** catálogo de documentación técnica indexada, con fuentes, versiones y ejemplos.
- **Framework Registry:** adaptadores ampliables para frameworks de WhatsApp, Telegram, Discord y proyectos personalizados.
- **Command Engine:** generación de archivos de comandos, configuración, dependencias e instrucciones de integración.
- **Code Validator:** comprobaciones de estructura, sintaxis, imports y compatibilidad antes de entregar el código.

### Flujo de trabajo previsto

1. El desarrollador indica qué bot utiliza o proporciona la estructura y los archivos relevantes de su proyecto.
2. El sistema identifica el framework y la versión cuando la información está disponible.
3. El agente consulta la documentación y los ejemplos correspondientes en el Knowledge Hub.
4. El Command Engine prepara los archivos solicitados siguiendo la estructura detectada.
5. El Validator revisa el resultado y señala cualquier incompatibilidad o requisito pendiente.
6. El desarrollador recibe el código, los archivos y las instrucciones para integrarlo y probarlo.

El sistema deberá indicar qué información verificó y qué partes son supuestos. No debe inventar métodos, eventos ni opciones de una librería cuando no estén respaldados por documentación.

### Compatibilidad prevista

| Ecosistema | Frameworks y fuentes que se evaluarán |
| --- | --- |
| WhatsApp | Baileys, WPPConnect, Venom y otros proyectos compatibles |
| Telegram | Telegram Bot API, Telegraf y grammY |
| Discord | Discord.js y otras librerías compatibles |
| Personalizados | Proyectos propios y documentación aportada por el desarrollador |

La compatibilidad será progresiva y dependerá de la documentación disponible, las versiones y las pruebas de cada adaptador. No se promete compatibilidad automática con cualquier bot sin analizar su código.

### Integraciones de IA

La arquitectura contempla dos modalidades complementarias:

- **Asistente propio:** experiencia de ayuda dentro de la web de YuiAPI. La conexión a un modelo de IA se definirá mediante proveedores configurables; no se presupone que exista un modelo propio ni una conexión activa actualmente.
- **MCP para agentes externos:** servidor que expondrá herramientas controladas para buscar documentación, consultar frameworks, revisar endpoints y solicitar la generación o validación de comandos.

Herramientas MCP previstas:

| Herramienta | Propósito |
| --- | --- |
| `search_docs` | Buscar en la documentación indexada |
| `get_framework` | Consultar información y versiones de un framework |
| `get_api_endpoint` | Obtener detalles del catálogo de endpoints de YuiAPI |
| `inspect_bot` | Analizar archivos y estructura proporcionados por el usuario |
| `generate_command` | Proponer los archivos de un comando |
| `validate_command` | Revisar el código generado |
| `get_examples` | Recuperar ejemplos documentados |

### Seguridad y límites

- Las API Keys actuales y la autenticación de cuentas deberán conservar su funcionamiento.
- El acceso a herramientas MCP requerirá autenticación, permisos y límites de uso.
- Las claves de proveedores de IA, si se incorporan, se almacenarán únicamente en el servidor.
- Los documentos externos y archivos aportados se tratarán como contenido no confiable.
- El código generado no se ejecutará automáticamente.
- Cualquier escritura en un repositorio, instalación de dependencias o despliegue requerirá autorización explícita.
- Se registrarán las fuentes y versiones utilizadas para facilitar la revisión de resultados.

### Roadmap

| Etapa | Trabajo | Estado |
| --- | --- | --- |
| 1 | Knowledge Hub y catálogo de frameworks | Planificado |
| 2 | Command Engine y Code Validator | Planificado |
| 3 | Yui Assistant integrado en la web | Planificado |
| 4 | Servidor MCP para Claude y otros clientes compatibles | Planificado |
| 5 | Historial, permisos, límites y ampliación de adaptadores | Planificado |

El desarrollo se realizará por etapas y con pruebas independientes. Se priorizará reutilizar el catálogo de endpoints existente en `src/lib/endpoints.ts` y la infraestructura actual antes de introducir servicios o bases de datos adicionales.

### Referencias

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Documentación de Claude](https://docs.anthropic.com/)
- [Repositorio de YuiAPI](https://github.com/AmilcarGit/AmilcarGit-Stickers)

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Upstash Redis (REST) · cuentas propias (`scrypt`, cookie `HttpOnly` firmada) · nodemailer (SMTP) · sharp · qrcode · Vitest · GitHub Actions · Vercel.

## Configuración

Variables (ver `.env.example`; en Vercel, solo como variables de entorno, **nunca** en el repositorio):

| Variable | Para qué |
| --- | --- |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Base de datos |
| `AUTH_SECRET` | 32+ caracteres aleatorios para firmar sesiones |
| `ADMIN_EMAILS` | Correos (verificados) con acceso a `/admin` |
| `SMTP_URL`, `EMAIL_FROM` | Correos de verificación y recuperación |
| `NEXT_PUBLIC_SITE_URL` | URL final (`https://yuiapi.vercel.app`) |
| `GIPHY_API_KEY` | Opcional: stickers de Giphy |

Desarrollo local:

```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

Scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Organización

```
src/
  app/        páginas (/, /endpoints, /docs, /dashboard, /admin, /settings, /legal, auth) y rutas /api
    api/v1/   la API pública (clave)
    api/auth, keys, me, admin   API de la web (sesión por cookie)
  components/ Header, Footer, Mascot, Providers, Guards
  lib/        endpoints.ts (catálogo), whatsapp.ts, validators, cliente de la web
  server/     cuentas, sesiones, claves y cuotas, proveedores externos, herramientas, conversión
```

Más detalle en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Seguridad

- Contraseñas con `scrypt` y sal; sesión `HttpOnly` con registro en Redis (cerrar sesión o cambiar contraseña la invalida).
- Límites de intentos en registro, login, reenvíos y recuperación; respuestas que no revelan si un correo existe.
- Comprobación de `Origin` en toda petición de la web que modifica datos.
- Claves de API solo como hash; cuota diaria y por minuto en Redis.
- Administradores: solo correos verificados en `ADMIN_EMAILS`.

## Limitaciones conocidas

- Sin `SMTP_URL` no hay verificación de correo y, por tanto, nadie puede crear claves.
- Los proveedores externos pueden fallar o cambiar sin aviso (la API responde 503).
- No hay cambio de correo ni eliminación de cuenta desde la interfaz.
- Sin facturación: los planes Pro/Ultra los asigna un administrador a mano.

## Licencia del código

Pendiente de definir por el autor.
