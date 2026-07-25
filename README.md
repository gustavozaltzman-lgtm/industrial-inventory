# Industrial Inventory (IndInv)

Sistema de toma de inventarios industrial multi-tenant, offline-first y agnóstico a dispositivos de captura (smartphones, escáneres Cognex/Zebra, cámaras IP, robots AMR).

Ver decisiones de arquitectura en [docs/adr/ADR-001-monorepo-stack.md](docs/adr/ADR-001-monorepo-stack.md) y el mapa general en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Estructura

- `packages/core-domain` — lógica de negocio pura, sin dependencias de infraestructura.
- `apps/backend` — API Fastify (adaptadores de persistencia Postgres/Neon, ingesta HTTP).
- `apps/mobile` — app Expo/React Native (SQLite local, offline-first).
- `apps/web` — dashboard Next.js.

## Desarrollo

```bash
pnpm install
pnpm dev
```
