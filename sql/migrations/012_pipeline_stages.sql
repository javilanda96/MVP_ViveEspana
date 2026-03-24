-- Migration 012: pipeline_stages
-- Purpose: store correct display order for pipeline stages
-- Required by: sales_funnel_basic view (ordered funnel rendering)
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id             SERIAL PRIMARY KEY,
  pipeline_name  TEXT        NOT NULL,
  stage_name     TEXT        NOT NULL,
  display_order  INTEGER     NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pipeline_name, stage_name)
);

-- Seed: Sales pipeline — order confirmed from opportunity_stage_history transitions
-- New Lead → Contacted → Proposal Sent (2 observed transitions, no contradictions)
INSERT INTO pipeline_stages (pipeline_name, stage_name, display_order)
VALUES
  ('Sales', 'New Lead',       1),
  ('Sales', 'Contacted',      2),
  ('Sales', 'Proposal Sent',  3)
ON CONFLICT (pipeline_name, stage_name) DO NOTHING;

-- Post-validation (run manually to confirm):
-- SELECT pipeline_name, stage_name, display_order
-- FROM pipeline_stages
-- WHERE pipeline_name = 'Sales'
-- ORDER BY display_order;
-- Expected: 3 rows in order New Lead(1), Contacted(2), Proposal Sent(3)
