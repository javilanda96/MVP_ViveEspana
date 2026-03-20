-- ============================================================================
-- MIGRACIÓN 008: tabla payment_alerts
-- Alertas operativas de cobros detectadas automáticamente.
-- Separado de events_log (auditoría técnica inmutable) por diseño.
--
-- Ciclo de vida de una alerta: open → resolved | dismissed
-- No tiene updated_at: closed_at cubre la única transición relevante post-insert.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_alerts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id       UUID         NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  rule_code        VARCHAR(50)  NOT NULL,
  severity         VARCHAR(20)  NOT NULL,                        -- critical | warning
  status           VARCHAR(20)  NOT NULL DEFAULT 'open',         -- open | resolved | dismissed
  message          TEXT         NOT NULL,                        -- descripción legible por humanos
  context          JSONB        NOT NULL DEFAULT '{}',           -- valores exactos usados en la evaluación
  detected_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  closed_at        TIMESTAMP WITH TIME ZONE,                     -- se establece al resolver o descartar
  resolution_notes TEXT,                                         -- comentario opcional del operador al cerrar

  CONSTRAINT payment_alerts_payment_rule_unique UNIQUE (payment_id, rule_code)
);

CREATE INDEX IF NOT EXISTS idx_payment_alerts_payment_id  ON payment_alerts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_alerts_status      ON payment_alerts(status);
CREATE INDEX IF NOT EXISTS idx_payment_alerts_severity    ON payment_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_payment_alerts_detected_at ON payment_alerts(detected_at DESC);

COMMENT ON TABLE payment_alerts IS 'Alertas operativas de cobros detectadas automáticamente. Separado de events_log (auditoría técnica inmutable) por diseño.';
