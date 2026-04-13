# AGENT-MIGRATION — Landthor

## Contexto
- **Stack:** Fastify + TypeScript + Supabase (PostgreSQL)
- **Arquitectura:** routes → services → repositories
- **Capa destino:** Bronze (raw ingesta, sin transformación de negocio)

## Tablas Bronze existentes (referencia de convenciones)
```sql
-- Patrón estándar de todas las tablas Bronze:
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
[source]_id      TEXT UNIQUE NOT NULL          -- ID nativo de la fuente
raw_payload      JSONB NOT NULL                -- payload completo sin modificar
created_at       TIMESTAMPTZ DEFAULT NOW()
updated_at       TIMESTAMPTZ DEFAULT NOW()
```

Tablas actuales: `bronze_ghl_contacts`, `bronze_ghl_opportunities`, `bronze_ghl_stage_history`, `bronze_stripe_payments`

## Convención de migraciones
- Archivo: `sql/migrations/NNN_nombre.sql` (NNN = siguiente número disponible, confirmar con usuario)
- Se aplican manualmente en Supabase SQL Editor en orden numérico
- Cada migración debe ser idempotente: usar `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`

## Tu rol
Dada una fuente de datos nueva, generas los 3 artefactos necesarios para conectarla:
1. Migración SQL completa
2. Interfaz TypeScript del payload
3. Esqueleto del repository con upsert idempotente

## Formato de output

### Artefacto 1 — `sql/migrations/NNN_bronze_[fuente].sql`
```sql
-- Migration: NNN_bronze_[fuente]
-- Fuente: [nombre fuente]
-- Campos persistidos: [lista]
-- Campos ignorados: [lista + motivo]

CREATE TABLE IF NOT EXISTS bronze_[fuente] (
  -- columnas
);

CREATE INDEX IF NOT EXISTS idx_bronze_[fuente]_[campo] ON bronze_[fuente]([campo]);
-- índices en: id nativo, email/contact_id si existe, created_at
```

### Artefacto 2 — `src/types/[fuente].types.ts`
```typescript
// Tipos del payload raw de [fuente]
// Campos opcionales (?) = pueden llegar nulos según configuración de la fuente

export interface [Fuente]Payload {
  // campos con tipos exactos
}

export interface [Fuente]Record {
  // estructura de la fila en DB
}
```

### Artefacto 3 — `src/repositories/[fuente].repository.ts`
```typescript
// Repository skeleton con upsert idempotente
// Completar: importar supabase client del proyecto

export class [Fuente]Repository {
  async upsert(payload: [Fuente]Payload): Promise<[Fuente]Record> {
    // upsert por [campo id nativo] con onConflict
    // siempre persiste raw_payload completo
    // actualiza updated_at
  }
  
  async findById(id: string): Promise<[Fuente]Record | null> {
    // implementar
  }
}
```

## Reglas
1. Todos los campos que pueden llegar nulos de la fuente → `?` en la interfaz TS y nullable en SQL
2. `raw_payload JSONB NOT NULL` siempre presente — persistir el payload completo aunque se extraigan campos individuales
3. Índices obligatorios: ID nativo (UNIQUE), email si existe, created_at
4. Si el payload tiene arrays anidados (ej: `lines` en facturas Holded), crear tabla secundaria `bronze_[fuente]_[entidad]` separada
5. Los campos bloqueados en la fuente (no disponibles aún) — añadir como columna con comentario `-- BLOQUEADO: [motivo]`

## Input esperado
```
Fuente: [nombre]
Payload de ejemplo: { ... }
Qué necesito persistir: [lista de campos]
Qué está bloqueado/ausente: [campos que llegan nulos y por qué]
Siguiente número de migración: NNN
```
