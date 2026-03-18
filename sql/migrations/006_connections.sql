-- ============================================================================
-- MIGRACIÓN 006: tabla connections
-- Metadata de integraciones activas. Sin columnas de secretos.
-- ============================================================================

CREATE TABLE IF NOT EXISTS connections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  source      VARCHAR(50)  NOT NULL
                CHECK (source IN ('ghl','stripe','flywire','holded','manual')),
  event_type  VARCHAR(100) NOT NULL,
  endpoint    VARCHAR(255) NOT NULL,
  auth_type   VARCHAR(50)  NOT NULL
                CHECK (auth_type IN ('GHL Shared Secret','HMAC-SHA256','none')),
  description TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT connections_source_event_type_unique UNIQUE (source, event_type)
);

CREATE OR REPLACE TRIGGER connections_update_timestamp
  BEFORE UPDATE ON connections
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Seed: las tres integraciones actuales del sistema.
-- ON CONFLICT DO NOTHING: idempotente en re-ejecuciones.
INSERT INTO connections (name, source, event_type, endpoint, auth_type, description) VALUES
  ('GHL Contacts',       'ghl',    'contact.upsert',      '/webhooks/contacts',      'GHL Shared Secret', 'Sincronización de contactos desde GoHighLevel'),
  ('GHL Oportunidades',  'ghl',    'opportunity.updated', '/webhooks/opportunities', 'GHL Shared Secret', 'Cambios de etapa y valor en oportunidades GHL'),
  ('Stripe Pagos',       'stripe', 'payment.created',     '/webhooks/payments',      'HMAC-SHA256',       'Pagos recibidos desde Stripe')
ON CONFLICT (source, event_type) DO NOTHING;
