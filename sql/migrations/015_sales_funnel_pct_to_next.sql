-- Migration 015: Add pct_to_next to sales_funnel_with_period
-- Fixes zero-count stage gap: base CTE now comes from pipeline_stages (not opportunities),
-- so stages with 0 leads in the period still appear with count_open=0 and LEAD() steps
-- to the correct adjacent stage instead of skipping it.
--
-- DROP required because return type changes (pct_to_next column added).
DROP FUNCTION IF EXISTS sales_funnel_with_period(timestamptz, timestamptz);

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
  value_active   numeric,
  pct_to_next    numeric
)
LANGUAGE sql STABLE
AS $$
  WITH
  -- ── Backbone: every seeded stage, guaranteed even when 0 opportunities match ──
  seeded AS (
    SELECT
      ps.pipeline_name,
      ps.stage_name,
      ps.display_order,
      COALESCE(COUNT(o.id) FILTER (WHERE o.status = 'open'),                   0)::bigint AS count_open,
      COALESCE(COUNT(o.id) FILTER (WHERE o.status = 'won'),                    0)::bigint AS count_won,
      COALESCE(COUNT(o.id) FILTER (WHERE o.status IN ('lost', 'abandoned')),   0)::bigint AS count_lost,
      COALESCE(COUNT(o.id),                                                     0)::bigint AS count_total,
      COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'open'),          0) AS value_open,
      COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'won'),           0) AS value_won,
      COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status IN ('open','won')), 0) AS value_active
    FROM pipeline_stages ps
    LEFT JOIN opportunities o
      ON  o.pipeline_name = ps.pipeline_name
      AND o.stage_name    = ps.stage_name
      AND (from_date IS NULL OR o.created_at >= from_date)
      AND (to_date   IS NULL OR o.created_at <= to_date)
    GROUP BY ps.pipeline_name, ps.stage_name, ps.display_order
  ),
  -- ── Unmatched: stages present in opportunities but absent from pipeline_stages ──
  -- These render after the seeded stages (display_order NULL → NULLS LAST).
  unmatched AS (
    SELECT
      o.pipeline_name,
      o.stage_name,
      NULL::integer                                                              AS display_order,
      COUNT(o.id) FILTER (WHERE o.status = 'open')::bigint                     AS count_open,
      COUNT(o.id) FILTER (WHERE o.status = 'won')::bigint                      AS count_won,
      COUNT(o.id) FILTER (WHERE o.status IN ('lost', 'abandoned'))::bigint     AS count_lost,
      COUNT(o.id)::bigint                                                        AS count_total,
      COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'open'),          0) AS value_open,
      COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status = 'won'),           0) AS value_won,
      COALESCE(SUM(o.monetary_value) FILTER (WHERE o.status IN ('open','won')), 0) AS value_active
    FROM opportunities o
    LEFT JOIN pipeline_stages ps
      ON ps.pipeline_name = o.pipeline_name
      AND ps.stage_name   = o.stage_name
    WHERE ps.stage_name IS NULL
      AND (from_date IS NULL OR o.created_at >= from_date)
      AND (to_date   IS NULL OR o.created_at <= to_date)
    GROUP BY o.pipeline_name, o.stage_name
  ),
  combined AS (
    SELECT * FROM seeded
    UNION ALL
    SELECT * FROM unmatched
  )
  SELECT
    pipeline_name,
    stage_name,
    display_order,
    count_open,
    count_won,
    count_lost,
    count_total,
    value_open,
    value_won,
    value_active,
    ROUND(
      LEAD(count_open) OVER (
        PARTITION BY pipeline_name
        ORDER BY display_order NULLS LAST, stage_name
      )::numeric
      / NULLIF(count_open, 0) * 100,
      1
    ) AS pct_to_next
  FROM combined
  ORDER BY pipeline_name, display_order NULLS LAST, stage_name;
$$;
