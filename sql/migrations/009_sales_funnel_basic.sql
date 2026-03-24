-- =============================================================================
-- Migration 009: sales_funnel_basic view
-- =============================================================================
--
-- Purpose:
--   Pure stage-level snapshot. Aggregates current opportunity counts and
--   values by pipeline + stage. Feeds the P0 Sales MVP funnel chart.
--
-- Intentionally excluded:
--   conversion_pct — per-stage won/total is not a valid funnel conversion
--   metric because opportunities in earlier stages have not yet had the
--   chance to reach 'won'. Global conversion lives in sales_kpis_basic (011).
--
-- Design decisions:
--   - No join to a stage-order table (pipeline_stages not yet created).
--     Stage order is intentionally absent in this view. Rows are unordered
--     within each pipeline. Ordering will be added in a later migration.
--   - Includes ALL statuses (open / won / lost / abandoned) so the frontend
--     can choose which to display without additional queries.
--   - NULL pipeline_name and NULL stage_name rows are included. The frontend
--     must handle them explicitly (render as 'Sin etapa' / 'Sin pipeline').
--   - monetary_value is nullable per schema; COALESCE(SUM(...), 0) ensures
--     numeric output even when no rows have a value set.
--
-- Safe to re-run: CREATE OR REPLACE VIEW never fails on an existing view.
-- =============================================================================

CREATE OR REPLACE VIEW sales_funnel_basic AS
SELECT
  -- ── Grouping keys ───────────────────────────────────────────────────────────
  pipeline_name,
  stage_name,

  -- ── Count by status ─────────────────────────────────────────────────────────
  COUNT(*) FILTER (WHERE status = 'open')                               AS count_open,
  COUNT(*) FILTER (WHERE status = 'won')                                AS count_won,
  COUNT(*) FILTER (WHERE status IN ('lost', 'abandoned'))               AS count_lost,
  COUNT(*)                                                               AS count_total,

  -- ── Monetary value by status (NULL-safe) ────────────────────────────────────
  COALESCE(SUM(monetary_value) FILTER (WHERE status = 'open'),    0)   AS value_open,
  COALESCE(SUM(monetary_value) FILTER (WHERE status = 'won'),     0)   AS value_won,
  COALESCE(SUM(monetary_value) FILTER (WHERE status = 'open'), 0) +
  COALESCE(SUM(monetary_value) FILTER (WHERE status = 'won'),  0)      AS value_active

FROM opportunities
GROUP BY pipeline_name, stage_name;

COMMENT ON VIEW sales_funnel_basic IS
  'Sales MVP — pure stage snapshot. Counts and values by pipeline + stage. '
  'No stage ordering (pipeline_stages not yet created). '
  'No conversion_pct — global conversion lives in sales_kpis_basic (011).';
