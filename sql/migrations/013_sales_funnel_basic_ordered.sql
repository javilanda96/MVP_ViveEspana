-- Migration 013: add display_order to sales_funnel_basic via DROP + CREATE
-- Requires: 012_pipeline_stages.sql applied first
-- Why DROP instead of CREATE OR REPLACE: PostgreSQL rejects OR REPLACE when
-- the new column list changes the position of existing columns. display_order
-- must come before count_open to be useful, so DROP is required.
-- Safe: sales_kpis_basic (011) does not depend on this view.

DROP VIEW IF EXISTS sales_funnel_basic;

CREATE VIEW sales_funnel_basic AS
SELECT
  -- ── Grouping keys ─────────────────────────────────────────────────────────
  o.pipeline_name,
  o.stage_name,
  ps.display_order,

  -- ── Count by status ───────────────────────────────────────────────────────
  COUNT(*) FILTER (WHERE o.status = 'open')                              AS count_open,
  COUNT(*) FILTER (WHERE o.status = 'won')                               AS count_won,
  COUNT(*) FILTER (WHERE o.status IN ('lost', 'abandoned'))              AS count_lost,
  COUNT(*)                                                                AS count_total,

  -- ── Monetary value by status (NULL-safe) ──────────────────────────────────
  COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'open'),  0)  AS value_open,
  COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'won'),   0)  AS value_won,
  COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'open'),  0) +
  COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'won'),   0)  AS value_active

FROM opportunities o
LEFT JOIN pipeline_stages ps
  ON  ps.pipeline_name = o.pipeline_name
  AND ps.stage_name    = o.stage_name
GROUP BY
  o.pipeline_name,
  o.stage_name,
  ps.display_order
ORDER BY
  o.pipeline_name,
  ps.display_order NULLS LAST,
  o.stage_name;

COMMENT ON VIEW sales_funnel_basic IS
  'Sales MVP — stage snapshot with ordering. Counts and values by pipeline + stage. '
  'display_order sourced from pipeline_stages (012). '
  'Stages with no match in pipeline_stages appear last (display_order NULL). '
  'No conversion_pct — global conversion lives in sales_kpis_basic (011).';

-- Post-validation:
-- SELECT stage_name, display_order FROM sales_funnel_basic WHERE pipeline_name = 'Sales' ORDER BY display_order NULLS LAST;
-- Expected: New Lead(1), Proposal Sent(3) — Contacted absent (0 current opps)
-- SELECT COUNT(*) FROM sales_funnel_basic WHERE pipeline_name = 'Sales' AND display_order IS NULL;
-- Expected: 0
