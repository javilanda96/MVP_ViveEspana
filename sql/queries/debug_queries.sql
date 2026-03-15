-- =============================================================================
-- Debug / Validation Queries — Data Integrity Checks
-- =============================================================================
--
-- Use these queries to validate that data is arriving correctly from
-- GoHighLevel webhooks and that the pipeline state is consistent.
--
-- These queries are read-only. They do not modify any data.
-- Run in Supabase SQL Editor or any PostgreSQL client.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Query 1: Latest Opportunities
-- Shows the 20 most recently created or updated opportunities.
-- Use this to confirm that incoming GHL webhooks are being stored correctly.
-- -----------------------------------------------------------------------------

SELECT
  o.id                   AS opportunity_id,
  o.external_id          AS ghl_opportunity_id,
  o.name                 AS opportunity_name,
  c.email                AS contact_email,
  o.pipeline_name,
  o.stage_name,
  o.status,
  o.monetary_value,
  o.currency,
  o.created_at,
  o.updated_at
FROM opportunities o
JOIN contacts c
  ON c.id = o.contact_id
ORDER BY o.updated_at DESC
LIMIT 20;


-- -----------------------------------------------------------------------------
-- Query 2: Latest Stage Movements
-- Shows the 20 most recent entries in the stage history audit trail.
-- Use this to verify that stage transitions are being recorded correctly
-- and to trace the journey of a specific opportunity.
-- -----------------------------------------------------------------------------

SELECT
  h.id                   AS history_id,
  o.name                 AS opportunity_name,
  o.external_id          AS ghl_opportunity_id,
  c.email                AS contact_email,
  h.from_stage_name,
  h.to_stage_name,
  h.status,
  h.monetary_value,
  h.moved_at,
  h.ghl_event_id
FROM opportunity_stage_history h
JOIN opportunities o
  ON o.id = h.opportunity_id
JOIN contacts c
  ON c.id = o.contact_id
ORDER BY h.moved_at DESC
LIMIT 20;


-- -----------------------------------------------------------------------------
-- Query 3: Contacts with Most Opportunities
-- Lists contacts ranked by how many opportunities they have, with totals.
-- Use this to identify the most active prospects in the pipeline and to
-- spot contacts that may have been created multiple times (duplicates).
-- -----------------------------------------------------------------------------

SELECT
  c.id                                       AS contact_id,
  c.email                                    AS contact_email,
  CONCAT_WS(' ',
    NULLIF(TRIM(c.first_name), ''),
    NULLIF(TRIM(c.last_name),  '')
  )                                          AS contact_full_name,
  c.source,
  COUNT(o.id)                                AS opportunities_count,
  COUNT(CASE WHEN o.status = 'open' THEN 1 END)     AS open_count,
  COUNT(CASE WHEN o.status = 'won'  THEN 1 END)     AS won_count,
  COUNT(CASE WHEN o.status = 'lost' THEN 1 END)     AS lost_count,
  COALESCE(SUM(o.monetary_value), 0)         AS total_pipeline_value,
  MIN(o.currency)                            AS currency,
  MAX(o.updated_at)                          AS last_activity
FROM contacts c
LEFT JOIN opportunities o
  ON o.contact_id = c.id
GROUP BY c.id, c.email, c.first_name, c.last_name, c.source
HAVING COUNT(o.id) > 0
ORDER BY opportunities_count DESC,
         total_pipeline_value DESC NULLS LAST
LIMIT 25;


-- -----------------------------------------------------------------------------
-- Bonus: Recent webhook events (last 50)
-- Use this to confirm that the events_log is capturing all incoming webhooks
-- and to diagnose any failed processing.
-- -----------------------------------------------------------------------------

SELECT
  webhook_source,
  event_type,
  status,
  external_event_id,
  error_message,
  created_at,
  processed_at
FROM events_log
ORDER BY created_at DESC
LIMIT 50;
