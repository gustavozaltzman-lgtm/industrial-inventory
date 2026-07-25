# Arquitectura — IndInv

Mapa de alto nivel del sistema. Para el razonamiento detrás de cada decisión, ver `docs/adr/`.

## Capas (Hexagonal / Ports & Adapters)

```
                        ┌─────────────────────────┐
                        │   @indinv/core-domain    │
                        │  (entidades, Zod, ports, │
                        │   use-cases — sin infra) │
                        └────────────┬─────────────┘
                                     │ implementa puertos
              ┌──────────────────────┼──────────────────────┐
              │                      │                       │
     ┌────────▼────────┐   ┌─────────▼────────┐   ┌──────────▼─────────┐
     │  apps/backend    │   │   apps/mobile     │   │     apps/web        │
     │  Fastify +        │   │  Expo + SQLite     │   │  Next.js dashboard  │
     │  Drizzle/Postgres │   │  (offline-first)   │   │  (solo lectura)     │
     │  Neon + RLS        │   │  SyncManager       │   │                     │
     └────────────────────┘   └────────────────────┘   └─────────────────────┘
```

Regla dura: nada en `packages/core-domain` importa Drizzle, Fastify, Expo, ni ningún SDK de
infraestructura. Los `apps/*` dependen de `@indinv/core-domain`, nunca al revés.

## Entidades de dominio (`packages/core-domain/src/entities`)

- `Tenant` — organización dueña de los datos (multi-tenancy).
- `User` — usuario con rol (`ADMIN` | `SUPERVISOR` | `OPERATOR`) dentro de un tenant.
- `Warehouse` / `Location` — depósito y ubicación física (rack/aisle/level, `depthCm` opcional).
- `Product` — SKU con dimensiones (`widthCm`, `heightCm`, `depthCm`, `weightKg`).

## Evento de dominio inmutable

`InventoryScanEvent` (`packages/core-domain/src/schemas/inventory-scan-event.schema.ts`) nunca se
edita. Las correcciones generan un nuevo evento `STOCK_ADJUSTMENT` que referencia al original vía
`adjustsEventId`, preservando la trazabilidad histórica completa (ver ADR-001 §3).

## Puertos (interfaces que cruzan el hexágono)

| Puerto | Propósito | Adaptador(es) actuales |
|---|---|---|
| `InventoryEventRepository` | Persistencia de eventos | `PostgresInventoryEventRepository` (backend), `SqliteInventoryEventRepository` (mobile) |
| `VisionEngineAdapter` | Decodificación de códigos | `MlKitVisionEngineAdapter` (stub, mobile) |
| `ScanIngestNormalizer` | Normaliza `ScanIngestPayload` heterogéneo → input de dominio | pendiente por dispositivo (Cognex/Zebra/AMR) |

## Multi-tenancy y seguridad

Postgres/Neon con RLS forzado (`FORCE ROW LEVEL SECURITY`) filtrando por `tenant_id` en
`users`, `warehouses`, `locations`, `skus` (tabla física de `Product`) e `inventory_scan_events`.
El backend fija `app.tenant_id` por transacción vía `withTenantContext` (ver
`apps/backend/src/adapters/persistence/db.ts`). Índices compuestos obligatorios:
`(tenant_id, id)` y `(tenant_id, created_at)` en cada tabla.

## Observabilidad

Fastify usa Pino como logger. El plugin `tenant-context.plugin.ts` adjunta `tenantId`,
`correlationId` y `traceId` a un child logger reasignado tanto en `request.log` como en
`reply.log` (son propiedades independientes en Fastify), de forma que **todo** log de un
request — incluido el `request completed` final — lleva ese contexto. `requestId` lo aporta
Fastify nativamente vía `genReqId`.

## Offline-first (mobile)

Los eventos se escriben primero en SQLite local (`inventory_scan_events_local`) con
`syncStatus = 'pending_sync'`. `SyncManager` los sube al backend en lotes cuando hay
conectividad, vía `POST /scan-events/batch`.

## Stack

Ver `docs/adr/ADR-001-monorepo-stack.md` para el detalle y la justificación de cada elección.
