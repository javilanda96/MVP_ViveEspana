-- =============================================================================
-- Migration 010: sales_deals_outcomes view
-- =============================================================================
--
-- Purpose:
--   Computes win_rank and deal_classification for every opportunity.
--   Feeds the P0 Sales MVP deals table and nueva-venta / cross-sell KPIs.
--
-- Business logic:
--   win_rank         — ROW_NUMBER per contact_id ordered by the date the
--                      opportunity first transitioned to status='won'.
--   deal_classification:
--     win_rank = 1   → 'nueva_venta'   (first ever sale on this contact)
--     win_rank > 1   → 'cross_sell'    (second or later sale on same contact)
--     NULL           → not won yet (open / lost / abandoned)
--
-- Source for won timestamp:
--   Preferred: MIN(opportunity_stage_history.moved_at) WHERE status='won'
--   Fallback:  opportunities.updated_at
--   Rationale: stage_history may be absent if the opportunity was created
--              directly as 'won' with no prior stage transitions recorded.
--
-- Scope:
--   All opportunities are included regardless of status.
--   win_rank and deal_classification are NULL for non-won opportunities.
--   This lets the deals table show the full pipeline while marking won rows.
--
-- Safe to re-run: CREATE OR REPLACE VIEW.
-- =============================================================================

CREATE OR REPLACE VIEW sales_deals_outcomes AS

-- Step 1 — find the earliest timestamp each opportunity reached status='won'.
-- We look in opportunity_stage_history first because it has accurate event
-- timestamps; fall back to opportunities.updated_at for rows with no history.
WITH first_won_ts AS (
  SELECT
    o.id                                                           AS opportunity_id,
    o.contact_id,
    COALESCE(
      MIN(h.moved_at) FILTER (WHERE h.status = 'won'),
      o.updated_at
    )                                                              AS won_at
  FROM       opportunities           o
  LEFT JOIN  opportunity_stage_history h  ON h.opportunity_id = o.id
  WHERE      o.status = 'won'
  GROUP BY   o.id, o.contact_id, o.updated_at
),

-- Step 2 — rank won opportunities per contact chronologically.
-- The earliest won opportunity gets win_rank = 1 (nueva venta).
-- Any subsequent won opportunity on the same contact gets win_rank > 1 (cross-sell).
win_ranked AS (
  SELECT
    opportunity_id,
    contact_id,
    won_at,
    ROW_NUMBER() OVER (
      PARTITION BY contact_id
      ORDER BY     won_at
    )                                                              AS win_rank
  FROM first_won_ts
)

-- Step 3 — project all opportunities with contact info and win metadata.
SELECT
  -- ── Opportunity ─────────────────────────────────────────────────────────────
  o.id                                                             AS opportunity_id,
  o.external_id,
  o.name                                                           AS opportunity_name,

  -- ── Contact ─────────────────────────────────────────────────────────────────
  o.contact_id,
  CONCAT_WS(' ',
    NULLIF(TRIM(c.first_name), ''),
    NULLIF(TRIM(c.last_name),  '')
  )                                                                AS contact_full_name,
  c.email                                                          AS contact_email,

  -- ── Pipeline / Stage ────────────────────────────────────────────────────────
  o.pipeline_name,
  o.stage_name,
  o.status,

  -- ── Value / Assignment ──────────────────────────────────────────────────────
  o.monetary_value,
  o.currency,
  o.assigned_to,

  -- ── Timestamps ──────────────────────────────────────────────────────────────
  o.created_at,
  o.updated_at,
  o.last_stage_change_at,

  -- ── Sales classification ─────────────────────────────────────────────────────
  -- NULL for opportunities that have not been won yet.
  wr.win_rank,
  CASE
    WHEN wr.win_rank = 1 THEN 'nueva_venta'
    WHEN wr.win_rank > 1 THEN 'cross_sell'
    ELSE NULL
  END                                                              AS deal_classification,

  -- When this opportunity was first marked as won (NULL if not won).
  wr.won_at

FROM       opportunities   o
JOIN       contacts        c   ON c.id = o.contact_id
LEFT JOIN  win_ranked      wr  ON wr.opportunity_id = o.id;

COMMENT ON VIEW sales_deals_outcomes IS
  'Sales MVP — all opportunities with win_rank and deal_classification. '
  'win_rank=1 => nueva_venta (first sale on contact). '
  'win_rank>1 => cross_sell. '
  'win_rank NULL => not yet won (open / lost / abandoned). '
  'Use for deals table and nueva-venta vs cross-sell KPI breakdown.';
