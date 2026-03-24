-- =============================================================================
-- Migration 011: sales_kpis_basic view
-- =============================================================================
--
-- Purpose:
--   Global Sales KPI snapshot — single row, all time, all pipelines combined.
--   Feeds the four KPI cards at the top of the Sales MVP tab:
--     - Total leads entered
--     - Total won (count + value)
--     - Global conversion rate (won / total)
--     - Active pipeline value
--
-- Why a view and not a query in the endpoint:
--   Consistent with the existing pattern (opportunity_overview, sales_funnel_basic).
--   Queryable directly in Supabase SQL Editor. Simple SELECT * from the endpoint.
--   When period filtering is needed (P1), this view is replaced by a
--   parameterised query in the repository — the view remains the all-time baseline.
--
-- Why conversion_pct belongs here and not in sales_funnel_basic:
--   total_won / total_leads is semantically valid only at the global level
--   (or within a time-bounded cohort). Across the full history of opportunities,
--   every lead has had a chance to close. Per-stage won/total has no such
--   guarantee — leads in early stages haven't had the chance to close yet.
--
-- Columns:
--   total_leads          — every opportunity ever created, any status
--   total_open           — currently in progress
--   total_won            — closed won (all time)
--   total_lost           — closed lost or abandoned (all time)
--   value_pipeline_active — sum of monetary_value for open opportunities
--   value_won_total       — sum of monetary_value for won opportunities
--   conversion_pct        — total_won / total_leads * 100 (all time)
--   avg_deal_value_won    — mean monetary_value of won opportunities
--                           NULL if no won opportunity has a monetary_value set
--
-- Safe to re-run: CREATE OR REPLACE VIEW.
-- =============================================================================

CREATE OR REPLACE VIEW sales_kpis_basic AS
SELECT
  -- ── Counts ──────────────────────────────────────────────────────────────────
  COUNT(*)                                                               AS total_leads,
  COUNT(*) FILTER (WHERE status = 'open')                               AS total_open,
  COUNT(*) FILTER (WHERE status = 'won')                                AS total_won,
  COUNT(*) FILTER (WHERE status IN ('lost', 'abandoned'))               AS total_lost,

  -- ── Values (NULL-safe) ──────────────────────────────────────────────────────
  COALESCE(SUM(monetary_value) FILTER (WHERE status = 'open'), 0)      AS value_pipeline_active,
  COALESCE(SUM(monetary_value) FILTER (WHERE status = 'won'),  0)      AS value_won_total,

  -- ── Conversion rate (global, all time) ──────────────────────────────────────
  -- NULLIF guards against division-by-zero on an empty table.
  -- Returns NULL (not 0) when no opportunities exist at all.
  ROUND(
    COUNT(*) FILTER (WHERE status = 'won') * 100.0
    / NULLIF(COUNT(*), 0),
  1)                                                                    AS conversion_pct,

  -- ── Average deal value (won only, NULL when no won rows have a value) ───────
  ROUND(
    AVG(monetary_value) FILTER (WHERE status = 'won'),
  2)                                                                    AS avg_deal_value_won

FROM opportunities;

COMMENT ON VIEW sales_kpis_basic IS
  'Sales MVP — global KPI snapshot, single row, all time. '
  'Conversion_pct = total_won / total_leads. '
  'Period filtering (this_month etc.) is a P1 task handled at query level.';
