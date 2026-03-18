-- ============================================================================
-- MIGRACIÓN 007: campos de configuración extendida en connections
-- Añade campos opcionales de configuración pública (sin secretos).
-- IF NOT EXISTS: idempotente en re-ejecuciones.
-- ============================================================================

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS base_url   TEXT,   -- URL base pública del proveedor (p.ej. https://api.gohighlevel.com)
  ADD COLUMN IF NOT EXISTS account_id TEXT,   -- ID de workspace / cuenta / location en el proveedor
  ADD COLUMN IF NOT EXISTS public_key TEXT,   -- Clave pública o client key (NO es un secreto de firma)
  ADD COLUMN IF NOT EXISTS notes      TEXT;   -- Notas operativas del operador
