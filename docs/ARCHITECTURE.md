# Arquitectura

## Visión general

```
Navegador (Next.js, cliente)                  Vercel (serverless)                 Servicios
┌─────────────────────────────┐   token     ┌───────────────────┐
│ Editor (canvas 512×512)     │  Firebase   │ /api/upload       │──► Vercel Blob (public)
│ Exportación WebP + mux      │───────────► │ /api/webp (sharp) │
│ Firebase Auth SDK           │             │ /api/zip          │◄── descarga de Blob
│ Firestore SDK               │             └───────────────────┘
└──────────────┬──────────────┘
               │ reglas de seguridad (firestore.rules)
               ▼
         Firebase Auth + Firestore
```

La mayor parte del trabajo (editar, renderizar, codificar WebP) ocurre **en el navegador**, así que el servidor casi no consume recursos: solo valida y almacena lo que se publica.

## Decisiones

**Firebase Auth + Firestore, no Vercel Postgres/NextAuth.** Vercel no trae base de datos ni cuentas. Firebase ofrece verificación de correo, recuperación de contraseña y persistencia de sesión sin que la app toque contraseñas, con un plan gratuito suficiente para empezar.

**Vercel Blob, no Firebase Storage.** Firebase Storage requiere plan de pago; Blob usa la capa gratuita de Vercel y se integra con el mismo despliegue.

**Verificación de tokens con `jose`, sin Firebase Admin.** Evita guardar una cuenta de servicio. Se valida la firma contra las claves públicas de Google, el emisor `https://securetoken.google.com/<proyecto>` y la audiencia (id del proyecto).

**Render del sticker por capas (`SceneRenderer`).** Elementos → silueta oscura desplazada N veces (extrusión 3D) → degradado de luz recortado al sticker → silueta blanca dilatada (borde) → sombra. Todo con canvas 2D, sin WebGL, así funciona igual en Android, iPhone y escritorio.

**Filtros y quitar fondo a mano.** Safari no soporta `ctx.filter`; operar sobre los píxeles es portable. El fondo se borra con relleno por inundación desde los bordes, de modo que los detalles interiores del mismo color se conservan.

**WebP animado ensamblado a mano (`webp-mux.ts`).** Los navegadores solo codifican WebP estático. Cada cuadro se codifica por separado y se unen en un contenedor RIFF con `VP8X` (animación + alfa), `ANIM` (bucle infinito) y un `ANMF` por cuadro. Verificado con el decodificador real de Chromium (`ImageDecoder`).

**Ajuste de peso automático.** Estático: baja la calidad hasta ≤100 KB. Animado: baja la calidad y luego los cuadros por segundo (12→10→8) hasta ≤500 KB.

**Safari.** `canvas.toBlob("image/webp")` devuelve PNG en Safari. `encodeWebp` lo detecta por el tipo del blob y envía el PNG a `/api/webp`, que lo convierte con sharp.

**Un único archivo de reglas de WhatsApp** (`src/lib/whatsapp.ts`). Si WhatsApp cambia sus límites, solo se edita ahí.

## Modelo de datos (Firestore)

| Colección | Documento | Notas |
| --- | --- | --- |
| `users/{uid}` | perfil | `username`, `displayName`, `bio`, `photoURL`, `profilePublic`, contadores |
| `usernames/{nombre}` | `{ uid }` | Garantiza usuarios únicos; se crea en el mismo lote que el perfil |
| `projects/{id}` | proyecto del editor | `sceneJson`, miniatura, autoría; solo lo lee su dueño |
| `packs/{id}` | paquete publicado | `listed` = público y activo; `status` lo cambia solo un moderador |
| `favorites/{uid_packId}` | favorito | |
| `reports/{id}` | reporte | Solo lo leen moderadores |
| `admins/{uid}` | moderador | Solo se crea desde la consola de Firebase |

`packs.listed` existe para consultar paquetes públicos con un único filtro de igualdad y no exigir índices compuestos.

## Pruebas

Las funciones puras viven en `src/lib` y tienen pruebas junto a ellas (`*.test.ts`). El workflow `.github/workflows/ci.yml` ejecuta lint, comprobación de tipos, pruebas y build de producción en cada push y pull request.
