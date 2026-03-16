-- =============================================================================
-- Migration 005: Indexes required by the admin dashboard queries
-- =============================================================================
--
-- Two additive, non-destructive indexes that make the dashboard
-- log-viewer and stats endpoints fast as events_log grows.
--
-- Both use IF NOT EXISTS so this script is safe to re-run.
-- =============================================================================

-- Index used by the "filter by external_event_id" feature in the Logs page.
-- Without this, the query performs a full table scan on every search.
CREATE INDEX IF NOT EXISTS idx_events_log_external_event_id
  ON events_log (external_event_id);

-- Composite index for the stats and errors endpoints that filter by
-- (webhook_source, status) and order/range by created_at in the same query.
CREATE INDEX IF NOT EXISTS idx_events_log_source_status_created
  ON events_log (webhook_source, status, created_at DESC);
