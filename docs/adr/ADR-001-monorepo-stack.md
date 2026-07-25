# ADR-001: Selección de Monorepo, Arquitectura Hexagonal y Estrategia de Persistencia

## Estado
Aprobado

## Contexto
Se requiere construir un sistema de toma de inventarios industrial multi-tenant, offline-first y agnóstico a los dispositivos de captura (Smartphones comerciales, escáneres Cognex/Zebra, cámaras IP y robots AMR). El sistema debe ser capaz de escalar en funcionalidad sin generar acoplamiento entre la interfaz de usuario, los motores de visión/escaneo y la persistencia de datos.

## Decisiones de Arquitectura

### 1. Monorepo y Espacios de Trabajo (pnpm + Turborepo)
* **Decisión:** Utilizar `pnpm workspaces` con el namespace `@indinv/` gestionado mediante **Turborepo**.
* **Justificación:** Garantiza un tipado estricto compartido entre el cliente móvil, el backend y el dashboard web. Permite compilar y ejecutar tests de forma incremental y eficiente.
* **Estructura:**
  - `packages/core-domain`: Contiene la lógica de negocio pura, validaciones Zod, interfaces de repositorios y DTOs. Cero dependencias de infraestructura.
  - `apps/backend`: API en Fastify que implementa los adaptadores de persistencia (Postgres) e ingesta HTTP/Sockets.
  - `apps/mobile`: Aplicación móvil en React Native (Expo) que consume el paquete de dominio y utiliza SQLite local.
  - `apps/web`: Dashboard administrativo en Next.js.

### 2. Arquitectura Hexagonal (Ports & Adapters)
* **Decisión:** Aislar la lógica de dominio en `@indinv/core-domain`. Ningún caso de uso puede depender de clases concretas de infraestructura (ORMs, SDKs de visión o clientes HTTP).
* **Justificación:** Permite que hoy el escaneo se realice con Google ML Kit en un smartphone Android (Redmi Note) y mañana se reemplace por un lector industrial Cognex vía TCP Socket simplemente implementando la interfaz `VisionEngineAdapter` o `ScanIngestPayload`, sin tocar una sola línea de la lógica de inventario.

### 3. Inmutabilidad del Evento `InventoryScanEvent`
* **Decisión:** Los registros de inventario no son modificables (CRUD tradicional). Se modelan como **Eventos de Dominio Inmutables** (`InventoryScanEvent`).
* **Justificación:** En entornos logísticos industriales, la trazabilidad histórica es crítica. Las correcciones de stock no sobreescriben un registro previo; generan un nuevo evento de ajuste con marca de tiempo y `correlationId`.

### 4. Estrategia Offline-First y Sincronización
* **Decisión:** Uso de SQLite local en la app móvil gerenciado vía Drizzle ORM Mobile con esquema encriptado para datos sensibles.
* **Mecanismo de Sincronización:**
  - Las lecturas se guardan localmente como eventos con estado `pending_sync`.
  - Un servicio de background (`SyncManager`) procesa las lecturas en lotes (Batch REST Payload) cuando la conectividad se restablece.
  - Las imágenes comprimidas se suben a almacenamiento de objetos (R2/S3) y el backend persiste los metadatos en Neon Postgres.

### 5. Multi-Tenancy y Seguridad en Postgres (Neon.tech)
* **Decisión:** Aplicar **Row Level Security (RLS)** en PostgreSQL forzando la columna `tenant_id` en todas las tablas del dominio.
* **Performance:** Todas las tablas principales mantendrán índices compuestos obligatorios `(tenant_id, id)` y `(tenant_id, created_at)` para evitar la degradación de queries en entornos multi-inquilino.

## Consecuencias

### Positivas:
- Mantenibilidad extrema: La lógica de negocio está resguardada de cambios de frameworks o proveedores Cloud.
- Pruebas unitarias ultrarrápidas al no depender de bases de datos para probar reglas de dominio.
- Preparado para escalado de hardware heterogéneo desde el día uno.

### Negativas / Riesgos a mitigar:
- Mayor complejidad inicial de archivos (creación de Mappers, DTOs e Interfaces).
- Necesidad de mantener disciplinadamente la cobertura de índices en Neon Postgres para evitar sobrecostos por RLS.
