-- =============================================================================
-- Migration 003: opportunity_overview view
-- =============================================================================
--
-- Read-only business view combining opportunities, contacts, and succeeded
-- payments. Designed for client-facing sales pipeline reporting.
--
-- No tables are created or modified. Safe to re-run (CREATE OR REPLACE).
-- =============================================================================

CREATE OR REPLACE VIEW opportunity_overview AS
SELECT
  -- ── Opportunity ────────────────────────────────────────────────────────────
  o.id                                                        AS opportunity_id,
  o.name                                                      AS opportunity_name,

  -- ── Contact ────────────────────────────────────────────────────────────────
  o.contact_id                                                AS contact_id,
  -- CONCAT_WS skips NULL parts so single-name contacts render without
  -- a trailing/leading space (e.g. "María" not "María ")
  CONCAT_WS(' ',
    NULLIF(TRIM(c.first_name), ''),
    NULLIF(TRIM(c.last_name),  '')
  )                                                           AS contact_full_name,
  c.email                                                     AS contact_email,

  -- ── Pipeline / Stage ───────────────────────────────────────────────────────
  o.pipeline_name                                             AS pipeline_name,
  o.stage_name                                                AS stage_name,
  o.status                                                    AS status,

  -- ── Value ──────────────────────────────────────────────────────────────────
  o.monetary_value                                            AS monetary_value,
  o.currency                                                  AS currency,

  -- ── Timestamps ─────────────────────────────────────────────────────────────
  o.created_at                                                AS created_at,
  o.last_stage_change_at                                      AS last_stage_change_at,

  -- ── Payment aggregates (succeeded only, scoped to the same contact) ────────
  -- LEFT JOIN means opportunities with no payments still appear with 0 / 0.00
  COUNT(p.id)                                                 AS payments_count,
  COALESCE(SUM(p.amount), 0)                                  AS total_payments_amount

FROM opportunities o

-- Inner join: every opportunity must have a contact; orphaned rows are excluded
JOIN contacts c
  ON c.id = o.contact_id

-- Left join: include opportunities that have no succeeded payments yet
LEFT JOIN payments p
  ON  p.contact_id = c.id
  AND p.status     = 'succeeded'

GROUP BY
  o.id,
  o.name,
  o.contact_id,
  c.first_name,
  c.last_name,
  c.email,
  o.pipeline_name,
  o.stage_name,
  o.status,
  o.monetary_value,
  o.currency,
  o.created_at,
  o.last_stage_change_at;

-- Optional: document the view purpose for Supabase / psql \d+ output
COMMENT ON VIEW opportunity_overview IS
  'Client-facing sales pipeline view. Combines opportunities, contacts, and '
  'succeeded payments. Read-only — never modify rows through this view.';
