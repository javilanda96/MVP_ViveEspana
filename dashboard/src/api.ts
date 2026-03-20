/**
 * Typed API client for the /admin/* endpoints.
 *
 * All requests are same-origin, credentials:"include" so the HttpOnly session
 * cookie is sent automatically by the browser.  ADMIN_API_KEY is never
 * present in this file or in any built asset.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatsData {
  total24h:            number;
  failed24h:           number;
  failureRate24h:      string;
  openOpportunities:   number;
  totalPaymentsAmount: number;
  openAlertsCritical:  number;
  openAlertsWarning:   number;
  failedPayments24h:   number;
}

export interface IntegrationData {
  name:          string;
  source:        string;
  endpoint:      string;
  authType:      string;
  secretPresent: boolean;
  lastSeen:      string | null;
  total24h:      number;
  failed24h:     number;
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

export interface PagedResponse<T> {
  data:  T[];
  total: number;
}

export interface EventsFilter {
  source?:            string;
  status?:            string;
  event_type?:        string;
  from?:              string;
  to?:                string;
  external_event_id?: string;
  limit?:             number;
  offset?:            number;
}

export interface ErrorsFilter {
  event_type?: string;
  from?:       string;
  to?:         string;
  limit?:      number;
  offset?:     number;
}

export interface PipelineRow {
  opportunity_id:        string;
  opportunity_name:      string;
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

export interface PipelineFilter {
  status?:        string;
  pipeline_name?: string;
  limit?:         number;
  offset?:        number;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

export class UnauthorizedError extends Error {
  constructor() { super("Unauthorized"); this.name = "UnauthorizedError"; }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/admin${path}`, {
    ...options,
    credentials: "include",
  });

  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

function toQS(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Check whether the current session cookie is valid without side-effects. */
export async function checkAuth(): Promise<boolean> {
  const res = await fetch("/admin/stats", { credentials: "include" });
  return res.status !== 401;
}

export async function login(key: string): Promise<boolean> {
  const res = await fetch("/admin/login", {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify({ key }),
    credentials: "include",
  });
  return res.ok;
}

export async function logout(): Promise<void> {
  await fetch("/admin/logout", { method: "POST", credentials: "include" });
}

// ─── Dashboard data ───────────────────────────────────────────────────────────

export const getStats = () =>
  apiFetch<StatsData>("/stats");

export const getIntegrations = () =>
  apiFetch<IntegrationData[]>("/integrations");

export const getEvents = (f: EventsFilter) =>
  apiFetch<PagedResponse<EventRow>>(`/events${toQS(f as Record<string, string | number | undefined>)}`);

export const getEventById = (id: string) =>
  apiFetch<EventDetail>(`/events/${id}`);

export const getErrors = (f: ErrorsFilter) =>
  apiFetch<PagedResponse<EventRow>>(`/errors${toQS(f as Record<string, string | number | undefined>)}`);

export const getPipeline = (f: PipelineFilter) =>
  apiFetch<PagedResponse<PipelineRow>>(`/pipeline${toQS(f as Record<string, string | number | undefined>)}`);

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface AlertRow {
  id:               string;
  payment_id:       string;
  rule_code:        string;
  severity:         string;
  status:           string;
  message:          string;
  context:          Record<string, unknown>;
  detected_at:      string;
  closed_at:        string | null;
  resolution_notes: string | null;
}

export interface AlertsFilter {
  status?:   string;
  severity?: string;
  from?:     string;
  to?:       string;
  limit?:    number;
  offset?:   number;
}

export const getAlerts = (f: AlertsFilter) =>
  apiFetch<PagedResponse<AlertRow>>(`/alerts${toQS(f as Record<string, string | number | undefined>)}`);

// ─── Connections ──────────────────────────────────────────────────────────────

export interface ConnectionRow {
  id:          string;
  name:        string;
  source:      string;
  event_type:  string;
  endpoint:    string;
  auth_type:   string;
  description: string | null;
  enabled:     boolean;
  base_url:    string | null;
  account_id:  string | null;
  public_key:  string | null;
  notes:       string | null;
  created_at:  string;
  updated_at:  string;
}

export interface ConnectionInput {
  name:        string;
  source:      string;
  event_type:  string;
  endpoint:    string;
  auth_type:   string;
  description: string | null;
  enabled:     boolean;
  base_url?:   string | null;
  account_id?: string | null;
  public_key?: string | null;
  notes?:      string | null;
}

export const getConnections = () =>
  apiFetch<ConnectionRow[]>("/connections");

export const createConnection = (body: ConnectionInput) =>
  apiFetch<ConnectionRow>("/connections", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

export const updateConnection = (id: string, patch: Partial<ConnectionInput>) =>
  apiFetch<ConnectionRow>(`/connections/${id}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(patch),
  });
