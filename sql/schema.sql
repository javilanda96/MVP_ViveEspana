-- ============================================================================
-- MVP SCHEMA: Integración de datos PYME
-- Plataformas: GoHighLevel (CRM), Stripe (Pagos), Holded (Facturación)
-- Base de datos: Supabase PostgreSQL
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 2. TABLAS CORE
-- Orden: contacts → invoices → payments → subscriptions
-- payments tiene FK a invoices: invoices debe existir primero
-- ============================================================================

-- contacts
CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(255),           -- nullable: no siempre viene del sistema externo
  email       VARCHAR(255),           -- nullable: contactos solo-teléfono permitidos
  first_name  VARCHAR(255),
  last_name   VARCHAR(255),
  phone       VARCHAR(20),
  country     VARCHAR(2),             -- código ISO: ES, MX, US...
  source      VARCHAR(50) NOT NULL,   -- ghl, stripe, manual
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata    JSONB,

  CONSTRAINT contacts_email_unique       UNIQUE (email),
  CONSTRAINT contacts_external_id_unique UNIQUE (external_id),
  CONSTRAINT contacts_phone_unique       UNIQUE (phone)  -- necesario para upsert onConflict:"phone"
);

CREATE INDEX IF NOT EXISTS idx_contacts_email      ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_source     ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_country    ON contacts(country);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- invoices (antes que payments por la FK invoice_id en payments)
CREATE TABLE IF NOT EXISTS invoices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id      VARCHAR(255),       -- ID en Holded
  contact_id       UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  number           VARCHAR(50) NOT NULL,
  amount           NUMERIC(12, 2) NOT NULL,
  currency         VARCHAR(3) NOT NULL,
  status           VARCHAR(50) NOT NULL,   -- draft, issued, paid, cancelled
  issued_at        TIMESTAMP WITH TIME ZONE,
  due_at           TIMESTAMP WITH TIME ZONE,
  synced_to_holded BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata         JSONB,

  CONSTRAINT invoices_number_unique UNIQUE (number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_contact_id            ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status                ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_synced_to_holded      ON invoices(synced_to_holded);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at            ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id_created_at ON invoices(contact_id, created_at DESC);

-- payments (invoices ya existe en este punto)
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(255) NOT NULL,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2) NOT NULL,
  currency    VARCHAR(3) NOT NULL,
  status      VARCHAR(50) NOT NULL,   -- pending, succeeded, failed, refunded
  provider    VARCHAR(50) NOT NULL,   -- stripe, flywire
  invoice_id  UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata    JSONB,

  CONSTRAINT payments_external_id_provider_unique UNIQUE (external_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_payments_contact_id            ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_status                ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider              ON payments(provider);
CREATE INDEX IF NOT EXISTS idx_payments_created_at            ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_contact_id_created_at ON payments(contact_id, created_at DESC);

-- subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id       VARCHAR(255) NOT NULL,
  contact_id        UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status            VARCHAR(50) NOT NULL,   -- active, inactive, cancelled, past_due
  plan_id           VARCHAR(255),
  amount            NUMERIC(12, 2) NOT NULL,
  currency          VARCHAR(3) NOT NULL,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata          JSONB,

  CONSTRAINT subscriptions_external_id_unique UNIQUE (external_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_contact_id        ON subscriptions(contact_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status            ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at        ON subscriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_contact_id_status ON subscriptions(contact_id, status);

-- ============================================================================
-- 3. TABLAS DE RESILIENCIA
-- ============================================================================

-- events_log: inmutable por diseño — NO tiene columna updated_at
CREATE TABLE IF NOT EXISTS events_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_source    VARCHAR(50)  NOT NULL,   -- ghl, stripe, flywire, holded, manual
  external_event_id VARCHAR(255) NOT NULL,
  event_type        VARCHAR(100) NOT NULL,   -- contact.upsert, payment_intent.succeeded...
  status            VARCHAR(50)  NOT NULL DEFAULT 'received',  -- received, processed, failed
  payload           JSONB        NOT NULL,
  error_message     TEXT,
  idempotency_key   VARCHAR(255) NOT NULL,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMP WITH TIME ZONE,

  CONSTRAINT events_log_idempotency_unique UNIQUE (webhook_source, external_event_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_events_log_source          ON events_log(webhook_source);
CREATE INDEX IF NOT EXISTS idx_events_log_event_type      ON events_log(event_type);
CREATE INDEX IF NOT EXISTS idx_events_log_status          ON events_log(status);
CREATE INDEX IF NOT EXISTS idx_events_log_created_at      ON events_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_log_idempotency_key ON events_log(idempotency_key);

-- sync_queue
CREATE TABLE IF NOT EXISTS sync_queue (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type   VARCHAR(50) NOT NULL,    -- invoice, contact, payment
  entity_id     UUID NOT NULL,
  target_system VARCHAR(50) NOT NULL,    -- holded, stripe
  action        VARCHAR(50) NOT NULL,    -- create, update, delete
  payload       JSONB NOT NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  retry_count   INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status        ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_target_system ON sync_queue(target_system);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity_type   ON sync_queue(entity_type);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at    ON sync_queue(created_at DESC);

-- ============================================================================
-- 3b. MIGRACIÓN: convergencia para tablas ya existentes
--
-- CREATE TABLE IF NOT EXISTS no modifica tablas que ya existen.
-- Este bloque corrige columnas y constraints en caso de que contacts (u otras
-- tablas) hubiera sido creada con una versión anterior del schema.
-- Todas las sentencias son idempotentes: no fallan si ya están aplicadas.
-- ============================================================================

-- contacts: email y external_id pasan a ser nullable
-- ALTER COLUMN DROP NOT NULL es no-op si la columna ya es nullable
ALTER TABLE contacts ALTER COLUMN email       DROP NOT NULL;
ALTER TABLE contacts ALTER COLUMN external_id DROP NOT NULL;

-- contacts: añadir constraints UNIQUE si no existen
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_email_unique' AND conrelid = 'contacts'::regclass
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_email_unique UNIQUE (email);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_external_id_unique' AND conrelid = 'contacts'::regclass
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_external_id_unique UNIQUE (external_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_phone_unique' AND conrelid = 'contacts'::regclass
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_phone_unique UNIQUE (phone);
  END IF;
END $$;

-- ============================================================================
-- 4. FUNCIÓN AUXILIAR: claim_event
--
-- Detecta si un evento es nuevo o duplicado.
-- Usa la columna de sistema xmax para distinguir INSERT de UPDATE:
--   xmax = 0  → fila recién insertada  → is_new = TRUE
--   xmax != 0 → fila actualizada (conflicto) → is_new = FALSE
--
-- Requiere DO UPDATE (no DO NOTHING) para que RETURNING devuelva la fila
-- en ambos casos y xmax quede correctamente asignado.
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_event(
  p_webhook_source     VARCHAR,
  p_external_event_id  VARCHAR,
  p_event_type         VARCHAR,
  p_payload            JSONB
)
RETURNS TABLE (
  event_id UUID,
  is_new   BOOLEAN
) AS $$
DECLARE
  v_event_id UUID;
  v_is_new   BOOLEAN;
BEGIN
  INSERT INTO events_log (
    webhook_source,
    external_event_id,
    event_type,
    status,
    payload,
    idempotency_key,
    created_at
  )
  VALUES (
    p_webhook_source,
    p_external_event_id,
    p_event_type,
    'received',
    p_payload,
    p_webhook_source || ':' || p_external_event_id || ':' || p_event_type,
    NOW()
  )
  ON CONFLICT (webhook_source, external_event_id, event_type)
  DO UPDATE SET status = 'received'
  RETURNING
    events_log.id,
    (events_log.xmax = 0)   -- TRUE si fue INSERT, FALSE si fue UPDATE por conflicto
  INTO v_event_id, v_is_new;

  RETURN QUERY SELECT v_event_id, v_is_new;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNCIÓN Y TRIGGERS PARA updated_at
-- Solo en tablas que tienen la columna updated_at.
-- events_log NO tiene updated_at: no lleva trigger.
-- CREATE OR REPLACE TRIGGER (Postgres 14+) permite re-ejecutar sin error.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER contacts_update_timestamp
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE TRIGGER invoices_update_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE TRIGGER payments_update_timestamp
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE TRIGGER subscriptions_update_timestamp
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE TRIGGER sync_queue_update_timestamp
  BEFORE UPDATE ON sync_queue
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 6. COMENTARIOS
-- ============================================================================

COMMENT ON TABLE contacts      IS 'Contactos centralizados: fuente de verdad sobre clientes de la pyme';
COMMENT ON TABLE invoices      IS 'Facturas emitidas, vinculadas a pagos y sincronizables a Holded';
COMMENT ON TABLE payments      IS 'Pagos recibidos de clientes, provenientes de Stripe o Flywire';
COMMENT ON TABLE subscriptions IS 'Suscripciones activas de clientes, provenientes de Stripe';
COMMENT ON TABLE events_log    IS 'Registro de auditoría: todos los eventos recibidos de webhooks';
COMMENT ON TABLE sync_queue    IS 'Cola de sincronización asincrónica hacia sistemas externos';

-- ============================================================================
-- FIN DEL SCHEMA
-- ============================================================================
