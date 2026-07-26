# Estado actual — Sprint 1: Núcleo Arquitectónico y Backend Multi-Tenant

Última actualización: 2026-07-26.

## Objetivo del sprint
Monorepo instalado, `@indinv/core-domain` con entidades/puertos/use-cases, migraciones
Postgres con RLS + índices, pipeline de ingesta en el backend con logging estructurado y
tests unitarios sobre los casos de uso.

## Checklist

- [x] Monorepo pnpm + Turborepo, namespace `@indinv/`.
- [x] `docs/adr/ADR-001-monorepo-stack.md`.
- [x] Entidades de dominio: `Tenant`, `User`, `Warehouse`, `Location` (con `depthCm`),
      `Product` (con dimensiones), `InventoryScanEvent` (inmutable).
- [x] Puertos: `InventoryEventRepository`, `VisionEngineAdapter`, `ScanIngestPayload` /
      `ScanIngestNormalizer`.
- [x] Migraciones Drizzle + RLS forzado + índices `(tenant_id, id)` y `(tenant_id, created_at)`
      en Neon (verificado en vivo).
- [x] Pipeline Fastify: routes → use-cases → repository, sin lógica de negocio en el controller.
- [x] Pino con `tenantId`, `requestId`, `correlationId`, `traceId` en cada log de request
      (verificado en vivo con `request completed`).
- [x] Tests unitarios de dominio con Vitest (inmutabilidad, trazabilidad de ajustes,
      transiciones de sync). 100% de cobertura (statements/branches/functions/lines) en
      `src/use-cases` y `src/events`, con umbral de 80% forzado en `vitest.config.ts`.
- [x] Tests de integración del backend (`app.inject()` con repositorio in-memory inyectado,
      sin tocar Neon): validación de tenant obligatorio, creación de eventos, aislamiento
      multi-tenant en listados, ajustes y su 404 cuando el evento original no existe.
- [x] Tailwind CSS + shadcn/ui en `apps/web` (`table`, `badge`, `button`), verificado en
      navegador contra datos reales de Neon.
- [x] Expo Router (file-based routing) en `apps/mobile` — ver nota de versión abajo.
- [x] Expo SecureStore: `SecureTokenStore` adapter listo (guarda/lee/borra token+tenantId en
      keychain/keystore). Sin flujo de login todavía — no había un backend de auth que integrar.
- [x] **Deploy en Vercel: https://industrial-inventory-web.vercel.app**
      Root Directory `apps/web`, con `vercel.json` propio porque el build por defecto falla:
      `apps/web` importa el `dist` compilado de `core-domain`, así que el buildCommand tiene
      que construir el dominio primero (`--filter=@indinv/web...`).
      Verificado en producción: carga en 0.83s con los 11 eventos reales de Neon, cero
      errores de consola, Tailwind aplicado (max-w-4xl → 896px, badge ámbar en `pending_sync`)
      y cadena completa Vercel → Render → Neon probada insertando un evento y viéndolo
      aparecer en el dashboard.

## Tarea #3 — Ingesta idempotente + Render (backend)

- [x] `InventoryEventRepository.findExistingIds(tenantId, ids)` — implementado en
      `PostgresInventoryEventRepository` (SQL `IN`) y `SqliteInventoryEventRepository` (mobile).
- [x] `IngestScanUseCase` (core-domain): valida el lote con `scanIngestBatchSchema`, descarta
      ids ya persistidos (`findExistingIds`) antes de `appendBatch`, lanza `TenantMismatchError`
      si algún evento no pertenece al tenant del request. Tests con mocks `vi.fn()` (5 casos:
      lote nuevo, dedup parcial, dedup total sin tocar el repo, tenant mismatch, payload inválido).
- [x] Fastify Type Provider Zod (`fastify-type-provider-zod`) configurado en `buildApp()`.
- [x] `POST /api/v1/scans/batch` (`apps/backend/src/routes/scans.ts`) — 201 con
      `{ inserted, duplicates }`. Verificado en vivo contra Neon: primer envío inserta 2,
      reenvío del mismo lote inserta 0/duplicates 2, evento de otro tenant devuelve 400.
- [x] `render.yaml` + `.node-version` preparados en la raíz del repo. Build command
      (`pnpm turbo run build --filter=@indinv/backend...`) y el `dist/server.js` resultante
      probados localmente — el server respeta `PORT` inyectado y no depende de `.env` en
      runtime (dotenv es un no-op silencioso si no hay archivo).
- [x] **Deploy en Render: https://indinv-backend.onrender.com** (plan `free`, region `ohio`
      para quedar junto a Neon en `us-east-2`). Verificado en vivo contra la base real:
      `/health` 200; batch nuevo -> `{inserted:2, duplicates:0}`; reenvío idéntico ->
      `{inserted:0, duplicates:2}`; evento de otro tenant -> 400; sin `x-tenant-id` -> 400.
      Lectura posterior confirma 2 eventos persistidos (no 4), probando la idempotencia.

### Notas de deploy (para no repetir los tropiezos)

- **Node 22, no 20.** `packageManager` está pineado a `pnpm@11.17.0`, y pnpm 11 requiere
  Node >=22.13 porque usa `node:sqlite`. Con Node 20 el build muere con
  `ERR_UNKNOWN_BUILTIN_MODULE`. Por eso `.node-version` dice `22` y `engines.node` es
  `>=22.13` — no bajarlos.
- **Free tier duerme el servicio** tras ~15 min sin tráfico; el primer request después
  tarda 30-60s. Aceptable en desarrollo, no para operarios escaneando en planta. Migrar a
  `plan: starter` (US$7/mes) o a Cloud Run cuando haya uso real.
- **`DATABASE_URL` se carga a mano en el dashboard de Render** (`sync: false` en el
  manifest, a propósito). Ojo de pegar el string completo con la contraseña real: pegar una
  versión enmascarada da `28P01 password authentication failed`, que confunde porque el
  usuario sí se identifica bien.
- **Pendiente de higiene:** rotar la contraseña de Neon (circuló en texto plano durante la
  configuración) y actualizarla en el `.env` local y en la env var de Render.

## Tarea #5 — Operations Center (@indinv/web)

- [x] **BFF / No Header Trust real**: el navegador nunca envía `x-tenant-id`. Habla con route
      handlers de Next (`src/app/api/operations/*`, `src/app/api/telemetry/stream`), que del
      lado servidor resuelven `getSession()` e inyectan el header al llamar a Render
      (`src/server/backendGateway.ts`). Verificado por grep: cero `x-tenant-id` en
      `components/`, `hooks/` o `services/`.
- [x] `apiClient.ts` — único punto de `fetch` del lado cliente; componentes y hooks no
      llaman a `fetch`/`axios` directo (verificado por grep).
- [x] SSE real: `TelemetryHub` en el backend (fan-out en memoria por tenant) + endpoint
      `GET /api/v1/events/stream` + proxy en Next (`api/telemetry/stream`, runtime nodejs
      porque edge cortaría la conexión) + `InventoryEventsStream` con reconexión y backoff
      + `useRealtimeTelemetry` que invalida TanStack Query (no escribe el cache a mano: el
      servidor sigue siendo la fuente de verdad de los agregados).
- [x] `StateBoundary` con los 4 estados (Loading/Error/Unauthorized/Empty), `aria-live`
      distinto para error (assertive) vs. el resto (polite), sin reintentar en 401.
- [x] `OperationsKpiGrid`, `DeviceFleetStatus`, `ReconciliationTable` (virtualizada con
      `@tanstack/react-virtual`, probada con 250 filas simuladas).
- [x] Layout de 4 módulos (`(operations)/{dashboard,inventory,devices,administration}`).
- [x] Vitest + RTL + MSW: 8 tests (loading, datos reales, null≠0, grupo accesible,
      unauthorized sin botón de retry, timeout con retry, aria-live assertive, empty).
- [x] **Verificado end-to-end en vivo, no solo con mocks**: insertar un evento por el
      backend real aparece en el dashboard sin recargar — KPI 3→4, feed muestra el evento,
      flota actualiza secuencia, conciliación suma cantidad. Los 4 endpoints del BFF
      probados contra Neon real.

### Decisiones y limitaciones honestas

- **No hay autenticación real todavía.** `getSession()` (`src/server/session.ts`) es un
  puerto explícito: hoy lee `INDINV_DEV_TENANT_ID` de una env var del servidor. El punto
  del diseño no es "ya hay JWT", es que el tenant se decide en el servidor y el cliente
  no puede tocarlo — eso ya se cumple y no cambia cuando se agregue JWT real, porque solo
  cambia el cuerpo de `getSession()`.
- **Device fleet sin heartbeats reales.** No existe tabla de heartbeats en Neon, así que
  `batteryLevel`, `isCharging` y `network` se devuelven `null`/`"unknown"` — la UI los
  muestra como "sin dato", nunca inventa un valor. `health` y `lastSeenAt` sí son reales,
  derivados de `capturedAt` de los eventos de escaneo.
- **Conciliación sin stock teórico.** No existe tabla de stock teórico, así que
  `theoreticalQuantity` y `variance` son `null`. `countedQuantity` sí es una suma real de
  `inventory_scan_events`.
- **`duplicateEventsRejected` es 0 siempre** — `IngestScanUseCase` no cuenta los que
  descarta. Hace falta agregar el contador ahí; el schema del KPI ya lo contempla.
- **`TelemetryHub` es en memoria**, particionado por tenant. Con más de una instancia de
  Render, un evento ingerido por la instancia A no llegaría a un panel conectado a la B.
  Documentado en el propio archivo; migrar a Redis pub/sub no cambia la interfaz pública.

## Tarea #6 — Cliente de escritorio (@indinv/desktop, Tauri 2.0)

- [x] Todos los archivos pedidos: `tauri.conf.json`, `capabilities/default.json`, `lib.rs`
      (registro de plugins + bandeja del sistema), `commands/hardware.rs` (puerto serie
      real vía el crate `serialport`, no un plugin comunitario sin verificar),
      `commands/db.rs` (init/stats/vacuum de SQLite local), `tauriBridge.ts` (adaptador
      Tauri↔navegador), `desktopSyncManager.ts`, `HardwareStatusWidget.tsx`,
      `tauriBridge.test.ts`.
- [x] **Verificado el lado TypeScript, de punta a punta**: typecheck limpio, 6/6 tests
      con los mocks oficiales de `@tauri-apps/api/mocks`, y `next build` con
      `output: "export"` genera el estático que Tauri va a servir (`Exporting (2/2)`).
      Workspace completo (5 paquetes) sigue en 15/15 tareas de Turbo tras el agregado.
- [ ] **El lado Rust NO se pudo compilar ni verificar.** No hay `cargo`/`rustc` en este
      entorno de desarrollo. El código está escrito siguiendo la API real de Tauri v2
      (revisada contra el código fuente instalado de `@tauri-apps/api`, no de memoria),
      pero nunca pasó por `cargo check`. Tratarlo como *no verificado* hasta que alguien
      con toolchain de Rust lo compile.
- [ ] Íconos de la app (`.ico`, `.icns`, PNGs) no generados — son binarios, requieren
      `pnpm tauri icon <logo.png>` con el CLI real. Documentado en
      `src-tauri/icons/README.md`.
- [ ] El Operations Center completo (KPIs, flota, conciliación de la Tarea #5) todavía no
      se reutiliza dentro de `apps/desktop` — el shell actual (`src/app/page.tsx`) solo
      monta `HardwareStatusWidget`. Portar los componentes de `apps/web` es directo (ya
      no dependen del BFF salvo por `apiClient`, que en desktop se reemplaza por
      `desktopSyncManager` + llamadas directas al backend).

### Decisión de arquitectura: por qué desktop no tiene BFF

Ver la sección nueva en `docs/ARCHITECTURE.md`. Resumen: `next export` no aloja servidor
Node, así que el patrón de la Tarea #5 (route handlers, sesión server-side, proxy SSE) no
es aplicable — no es una limitación, es cómo funciona el static export. `desktopSyncManager`
habla directo con `POST /api/v1/scans/batch` del backend.

## Notas para la próxima sesión

- **Expo Router v3 → v4:** el prompt pedía "Expo Router v3", pero esa versión va atada a
  Expo SDK 50. Con SDK 52 (ya elegido para cumplir "51+") el router correspondiente es v4.
  Se instaló v4 (`expo-router: ~4.0.9`) por compatibilidad real; v3 con SDK 52 hubiera roto el
  build. Si el pin a v3 es un requisito duro, hay que bajar todo el SDK a 50.
- La tabla física de `Product` sigue llamándose `skus` en Postgres (se evitó el rename para no
  arriesgar el prompt interactivo de `drizzle-kit generate` sobre una tabla ya migrada). El
  nombre de dominio (`Product`) y el de la tabla física (`skus`) están intencionalmente
  desacoplados — es un detalle de infraestructura, no una inconsistencia.
- `ScanIngestNormalizer` es una interfaz definida pero sin implementación concreta todavía:
  falta un adaptador real por dispositivo (Cognex/Zebra/AMR) cuando haya hardware para probar.
- No hay flujo de login/auth real (JWT, endpoints de sesión) — `User` es solo la entidad de
  dominio y `SecureTokenStore` el storage seguro; falta diseñar el caso de uso de autenticación.
