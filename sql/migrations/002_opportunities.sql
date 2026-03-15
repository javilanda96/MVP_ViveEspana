-- =============================================================================
-- Migration 002: Opportunities + Stage History
-- =============================================================================
--
-- Creates two tables:
--
--   opportunities             — mutable current state of each GHL opportunity
--   opportunity_stage_history — append-only business audit trail (never updated)
--
-- Both tables are idempotent (IF NOT EXISTS / CREATE OR REPLACE) so this script
-- can be re-run safely against an existing database.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. opportunities
-- ---------------------------------------------------------------------------
-- Tracks the live state of a GHL opportunity. Upserted on every webhook so
-- the row always reflects the latest CRM state.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunities (
  id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- GHL's own opportunity id — used as the natural key for upserts
  external_id          VARCHAR(255) NOT NULL,

  -- Contact this opportunity belongs to
  contact_id           UUID         NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Human-readable name of the opportunity (GHL "title" or "name" field)
  name                 VARCHAR(500) NOT NULL,

  -- Pipeline fields
  pipeline_id          VARCHAR(255) NOT NULL,
  pipeline_name        VARCHAR(255),

  -- Current stage
  stage_id             VARCHAR(255) NOT NULL,
  stage_name           VARCHAR(255),

  -- CRM status: open | won | lost | abandoned  (stored as-is from GHL)
  status               VARCHAR(50)  NOT NULL,

  -- Monetary value — nullable because not all opportunities have a value set
  monetary_value       NUMERIC(12, 2),
  currency             VARCHAR(3)   NOT NULL DEFAULT 'EUR',

  -- GHL user assigned to this opportunity
  assigned_to          VARCHAR(255),

  -- Timestamp of the last stage change recorded in GHL
  last_stage_change_at TIMESTAMP WITH TIME ZONE,

  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Arbitrary extra fields from GHL payload kept for debugging / future use
  metadata             JSONB,

  CONSTRAINT opportunities_external_id_unique UNIQUE (external_id)
);

-- Index used by the repository to look up by external_id before upserting
CREATE INDEX IF NOT EXISTS idx_opportunities_external_id
  ON opportunities (external_id);

-- Index to fetch all opportunities for a given contact
CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id
  ON opportunities (contact_id);

-- ---------------------------------------------------------------------------
-- 2. opportunity_stage_history
-- ---------------------------------------------------------------------------
-- Append-only table. One row per stage or status transition.
-- Never updated — no updated_at column, no update_timestamp trigger.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Parent opportunity
  opportunity_id  UUID         NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,

  -- Stage the opportunity was in before this transition (null for the first event)
  from_stage_id   VARCHAR(255),
  from_stage_name VARCHAR(255),

  -- Stage the opportunity moved to
  to_stage_id     VARCHAR(255) NOT NULL,
  to_stage_name   VARCHAR(255),

  -- CRM status at the time of this event
  status          VARCHAR(50)  NOT NULL,

  -- Monetary value at the time of this event (captured for historical reporting)
  monetary_value  NUMERIC(12, 2),

  -- When the move happened (defaults to now if GHL doesn't send a timestamp)
  moved_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- GHL webhook event id — allows correlating a history row back to a raw event
  ghl_event_id    VARCHAR(255)
);

-- Index to fetch the full stage history for an opportunity
CREATE INDEX IF NOT EXISTS idx_stage_history_opportunity_id
  ON opportunity_stage_history (opportunity_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger for opportunities
-- ---------------------------------------------------------------------------
-- Reuses the update_timestamp() function that already exists from the base
-- schema (sql/schema.sql). Applied only to opportunities — history is
-- append-only and must never be updated.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS opportunities_update_timestamp ON opportunities;

CREATE TRIGGER opportunities_update_timestamp
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
