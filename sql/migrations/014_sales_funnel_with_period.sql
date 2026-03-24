-- Migration 014: SQL functions for period-filtered sales funnel and KPIs
-- Replaces TypeScript aggregation logic in getSalesFunnelPeriodFiltered.
-- Both functions accept NULL params → equivalent to the unfiltered views.

-- ─── sales_funnel_with_period ─────────────────────────────────────────────────
-- Returns the same shape as sales_funnel_basic + display_order, filtered by
-- opportunities.created_at. NULL params = no date filter.

CREATE OR REPLACE FUNCTION sales_funnel_with_period(
  from_date timestamptz DEFAULT NULL,
  to_date   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  pipeline_name  text,
  stage_name     text,
  display_order  integer,
  count_open     bigint,
  count_won      bigint,
  count_lost     bigint,
  count_total    bigint,
  value_open     numeric,
  value_won      numeric,
  value_active   numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    o.pipeline_name,
    o.stage_name,
    ps.display_order,
    COUNT(*) FILTER (WHERE o.status = 'open')::bigint                             AS count_open,
    COUNT(*) FILTER (WHERE o.status = 'won')::bigint                              AS count_won,
    COUNT(*) FILTER (WHERE o.status IN ('lost', 'abandoned'))::bigint             AS count_lost,
    COUNT(*)::bigint                                                               AS count_total,
    COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'open'),          0) AS value_open,
    COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'won'),           0) AS value_won,
    COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status IN ('open','won')), 0) AS value_active
  FROM opportunities o
  LEFT JOIN pipeline_stages ps
    ON  ps.pipeline_name = o.pipeline_name
    AND ps.stage_name    = o.stage_name
  WHERE (from_date IS NULL OR o.created_at >= from_date)
    AND (to_date   IS NULL OR o.created_at <= to_date)
  GROUP BY o.pipeline_name, o.stage_name, ps.display_order
  ORDER BY o.pipeline_name, ps.display_order NULLS LAST, o.stage_name;
$$;

-- ─── sales_kpis_with_period ──────────────────────────────────────────────────
-- Returns global KPI aggregates, optionally scoped to a date range.
-- NULL params = equivalent to sales_kpis_basic view.

CREATE OR REPLACE FUNCTION sales_kpis_with_period(
  from_date timestamptz DEFAULT NULL,
  to_date   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_leads           bigint,
  total_open            bigint,
  total_won             bigint,
  total_lost            bigint,
  value_pipeline_active numeric,
  value_won_total       numeric,
  conversion_pct        numeric,
  avg_deal_value_won    numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COUNT(*)::bigint                                                                       AS total_leads,
    COUNT(*) FILTER (WHERE status = 'open')::bigint                                        AS total_open,
    COUNT(*) FILTER (WHERE status = 'won')::bigint                                         AS total_won,
    COUNT(*) FILTER (WHERE status IN ('lost', 'abandoned'))::bigint                        AS total_lost,
    COALESCE(SUM(monetary_value) FILTER (WHERE status IN ('open', 'won')),             0) AS value_pipeline_active,
    COALESCE(SUM(monetary_value) FILTER (WHERE status = 'won'),                        0) AS value_won_total,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'won')::numeric
      / NULLIF(COUNT(*), 0) * 100,
      1
    )                                                                                       AS conversion_pct,
    ROUND(
      COALESCE(SUM(monetary_value) FILTER (WHERE status = 'won' AND monetary_value > 0), 0)
      / NULLIF(COUNT(*) FILTER (WHERE status = 'won' AND monetary_value > 0), 0)
    )                                                                                       AS avg_deal_value_won
  FROM opportunities
  WHERE (from_date IS NULL OR created_at >= from_date)
    AND (to_date   IS NULL OR created_at <= to_date);
$$;
