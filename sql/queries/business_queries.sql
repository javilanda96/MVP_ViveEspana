-- =============================================================================
-- Business Queries — Sales Pipeline Reporting
-- =============================================================================
--
-- These queries are designed for client-facing reporting.
-- All queries run against the opportunity_overview view and the underlying
-- tables. No data is modified.
--
-- Run these directly in Supabase SQL Editor or any PostgreSQL client.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Query 1: Current Pipeline
-- All open opportunities ordered by monetary value (highest first).
-- Use this to see which deals the team should prioritise closing.
-- -----------------------------------------------------------------------------

SELECT
  opportunity_id,
  opportunity_name,
  contact_full_name,
  contact_email,
  pipeline_name,
  stage_name,
  monetary_value,
  currency,
  payments_count,
  total_payments_amount,
  created_at,
  last_stage_change_at
FROM opportunity_overview
WHERE  status = 'open'
ORDER BY monetary_value DESC NULLS LAST,
         created_at      DESC;


-- -----------------------------------------------------------------------------
-- Query 2: Revenue by Pipeline
-- Total collected (succeeded) payments grouped by pipeline.
-- Use this to understand which pipeline is generating the most real revenue.
-- -----------------------------------------------------------------------------

SELECT
  ov.pipeline_name,
  COUNT(DISTINCT ov.opportunity_id)          AS opportunities_total,
  COUNT(DISTINCT CASE
    WHEN ov.status = 'open' THEN ov.opportunity_id
  END)                                       AS opportunities_open,
  COUNT(DISTINCT CASE
    WHEN ov.status = 'won'  THEN ov.opportunity_id
  END)                                       AS opportunities_won,
  COALESCE(SUM(p.amount), 0)                 AS total_revenue_collected,
  MIN(p.currency)                            AS currency
FROM opportunities ov_base
JOIN contacts c
  ON c.id = ov_base.contact_id
LEFT JOIN payments p
  ON  p.contact_id = c.id
  AND p.status     = 'succeeded'
-- Use the base tables here so pipeline_name is always available even for
-- opportunities that have not yet generated any payment.
JOIN (
  SELECT DISTINCT id, pipeline_name
  FROM opportunities
) ov ON ov.id = ov_base.id
GROUP BY ov_base.pipeline_id, ov_base.pipeline_name
ORDER BY total_revenue_collected DESC NULLS LAST;


-- -----------------------------------------------------------------------------
-- Query 3: Opportunities by Stage
-- Count of opportunities at each stage across all pipelines.
-- Use this to identify bottlenecks: stages where deals are piling up.
-- -----------------------------------------------------------------------------

SELECT
  pipeline_name,
  stage_name,
  status,
  COUNT(*)                                   AS opportunities_count,
  COALESCE(SUM(monetary_value), 0)           AS pipeline_value,
  MIN(currency)                              AS currency,
  MIN(created_at)                            AS oldest_opportunity,
  MAX(created_at)                            AS newest_opportunity
FROM opportunity_overview
GROUP BY pipeline_name, stage_name, status
ORDER BY pipeline_name  ASC,
         opportunities_count DESC;
