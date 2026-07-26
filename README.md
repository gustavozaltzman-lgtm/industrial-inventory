# Industrial Inventory (IndInv)

Sistema de toma de inventarios industrial multi-tenant, offline-first y agnóstico a dispositivos de captura (smartphones, escáneres Cognex/Zebra, cámaras IP, robots AMR).

Ver decisiones de arquitectura en [docs/adr/ADR-001-monorepo-stack.md](docs/adr/ADR-001-monorepo-stack.md) y el mapa general en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Entornos

| Servicio | URL | Plataforma |
|---|---|---|
| Dashboard web | https://industrial-inventory-web.vercel.app | Vercel |
| API backend | https://indinv-backend.onrender.com | Render (plan free, region Ohio) |
| Base de datos | — | Neon Postgres (`us-east-2`, RLS por `tenant_id`) |

El backend corre en el plan free de Render: duerme tras ~15 min de inactividad y el primer
request tarda 30-60s en despertarlo (medido: 21s). El dashboard lo contempla — aborta a los
8s y muestra un aviso de "se está despertando" en vez de un error de plataforma.

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
