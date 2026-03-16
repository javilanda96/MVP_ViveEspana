/**
 * Admin repository — read-only Supabase queries for the operator dashboard.
 *
 * No writes. No side effects. All functions return plain data objects.
 */

import { supabase } from "../lib/supabase.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total24h:            number;
  failed24h:           number;
  failureRate24h:      string;   // "12.5" (percentage, no % sign)
  openOpportunities:   number;
  totalPaymentsAmount: number;
}

export interface EventRow {
  id:                string;
  webhook_source:    string;
  external_event_id: string;
  event_type:        string;
  status:            string;
  error_message:     string | null;
  idempotency_key:   string;
  created_at:        string;
  processed_at:      string | null;
}

export interface EventDetail extends EventRow {
  payload: Record<string, unknown>;
}

export interface EventsFilter {
  source?:             string;
  status?:             string;
  event_type?:         string;
  from?:               string;
  to?:                 string;
  external_event_id?:  string;
  limit?:              number;
  offset?:             number;
}

export interface PipelineFilter {
  status?:        string;
  pipeline_name?: string;
  limit?:         number;
  offset?:        number;
}

export interface IntegrationActivity {
  name:          string;
  source:        string;
  eventType:     string;
  endpoint:      string;
  authType:      string;
  secretPresent: boolean;
  lastSeen:      string | null;
  total24h:      number;
  failed24h:     number;
}

// ─── Hardcoded integration descriptors ───────────────────────────────────────
// Mirrors the three routes registered in src/index.ts.
// Update if new webhook routes are added.

const INTEGRATION_DESCRIPTORS = [
  {
    name:      "GHL Contacts",
    source:    "ghl",
    eventType: "contact.upsert",
    endpoint:  "/webhooks/contacts",
    authType:  "GHL Shared Secret",
    secretKey: "ghl",
  },
  {
    name:      "GHL Opportunities",
    source:    "ghl",
    eventType: "opportunity.updated",
    endpoint:  "/webhooks/opportunities",
    authType:  "GHL Shared Secret",
    secretKey: "ghl",
  },
  {
    name:      "Stripe Payments",
    source:    "stripe",
    eventType: "payment.created",
    endpoint:  "/webhooks/payments",
    authType:  "HMAC-SHA256",
    secretKey: "stripe",
  },
] as const;

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(): Promise<DashboardStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, failedRes, openOppRes, paymentsRes] = await Promise.all([
    supabase
      .from("events_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since),

    supabase
      .from("events_log")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since),

    supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),

    supabase
      .from("payments")
      .select("amount")
      .eq("status", "succeeded"),
  ]);

  const total24h  = totalRes.count  ?? 0;
  const failed24h = failedRes.count ?? 0;
  const openOpportunities = openOppRes.count ?? 0;
  const totalPaymentsAmount = (paymentsRes.data ?? [])
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const failureRate24h = total24h > 0
    ? ((failed24h / total24h) * 100).toFixed(1)
    : "0.0";

  return { total24h, failed24h, failureRate24h, openOpportunities, totalPaymentsAmount };
}

// ─── Integration activity ─────────────────────────────────────────────────────

export async function getIntegrationActivity(
  secretPresenceMap: Record<string, boolean>
): Promise<IntegrationActivity[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const results = await Promise.all(
    INTEGRATION_DESCRIPTORS.map(async (desc) => {
      const [lastSeenRes, totalRes, failedRes] = await Promise.all([
        supabase
          .from("events_log")
          .select("created_at")
          .eq("webhook_source", desc.source)
          .eq("event_type",     desc.eventType)
          .order("created_at", { ascending: false })
          .limit(1),

        supabase
          .from("events_log")
          .select("*", { count: "exact", head: true })
          .eq("webhook_source", desc.source)
          .eq("event_type",     desc.eventType)
          .gte("created_at",   since),

        supabase
          .from("events_log")
          .select("*", { count: "exact", head: true })
          .eq("webhook_source", desc.source)
          .eq("event_type",     desc.eventType)
          .eq("status",         "failed")
          .gte("created_at",   since),
      ]);

      return {
        name:          desc.name,
        source:        desc.source,
        eventType:     desc.eventType,
        endpoint:      desc.endpoint,
        authType:      desc.authType,
        secretPresent: secretPresenceMap[desc.secretKey] ?? false,
        lastSeen:      lastSeenRes.data?.[0]?.created_at ?? null,
        total24h:      totalRes.count  ?? 0,
        failed24h:     failedRes.count ?? 0,
      };
    })
  );

  return results;
}

// ─── Events log ───────────────────────────────────────────────────────────────

export async function getEvents(
  filter: EventsFilter
): Promise<{ data: EventRow[]; total: number }> {
  const limit  = Math.min(filter.limit  ?? 50, 100);
  const offset = filter.offset ?? 0;

  let query = supabase
    .from("events_log")
    .select(
      "id, webhook_source, external_event_id, event_type, status, error_message, idempotency_key, created_at, processed_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter.source)             query = query.eq("webhook_source",    filter.source);
  if (filter.status)             query = query.eq("status",            filter.status);
  if (filter.event_type)         query = query.eq("event_type",        filter.event_type);
  if (filter.from)               query = query.gte("created_at",       filter.from);
  if (filter.to)                 query = query.lte("created_at",       filter.to);
  if (filter.external_event_id)  query = query.eq("external_event_id", filter.external_event_id);

  const { data, error, count } = await query;
  if (error) throw new Error(`events query failed: ${error.message}`);

  return { data: (data ?? []) as EventRow[], total: count ?? 0 };
}

export async function getEventById(id: string): Promise<EventDetail | null> {
  const { data, error } = await supabase
    .from("events_log")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`event lookup failed: ${error.message}`);
  return data as EventDetail | null;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export interface ErrorsFilter {
  event_type?: string;
  from?:       string;
  to?:         string;
  limit?:      number;
  offset?:     number;
}

export async function getErrors(
  filter: ErrorsFilter
): Promise<{ data: EventRow[]; total: number }> {
  const limit  = Math.min(filter.limit  ?? 50, 100);
  const offset = filter.offset ?? 0;

  let query = supabase
    .from("events_log")
    .select(
      "id, webhook_source, external_event_id, event_type, status, error_message, idempotency_key, created_at, processed_at",
      { count: "exact" }
    )
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter.event_type) query = query.eq("event_type", filter.event_type);
  if (filter.from)       query = query.gte("created_at", filter.from);
  if (filter.to)         query = query.lte("created_at", filter.to);

  const { data, error, count } = await query;
  if (error) throw new Error(`errors query failed: ${error.message}`);

  return { data: (data ?? []) as EventRow[], total: count ?? 0 };
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineRow {
  opportunity_id:        string;
  opportunity_name:      string;
  contact_id:            string;
  contact_full_name:     string | null;
  contact_email:         string | null;
  pipeline_name:         string | null;
  stage_name:            string | null;
  status:                string;
  monetary_value:        number | null;
  currency:              string;
  created_at:            string;
  last_stage_change_at:  string | null;
  payments_count:        number;
  total_payments_amount: number;
}

export async function getPipeline(
  filter: PipelineFilter
): Promise<{ data: PipelineRow[]; total: number }> {
  const limit  = Math.min(filter.limit  ?? 50, 100);
  const offset = filter.offset ?? 0;

  let query = supabase
    .from("opportunity_overview")
    .select("*", { count: "exact" })
    .order("monetary_value", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (filter.status)        query = query.eq("status",        filter.status);
  if (filter.pipeline_name) query = query.eq("pipeline_name", filter.pipeline_name);

  const { data, error, count } = await query;
  if (error) throw new Error(`pipeline query failed: ${error.message}`);

  return { data: (data ?? []) as PipelineRow[], total: count ?? 0 };
}
