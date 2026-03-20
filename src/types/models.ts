// Tabla: contacts
export interface Contact {
  id: string;
  external_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
  source: "ghl" | "stripe" | "manual";
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

// Payload para insertar/actualizar un contacto (sin campos generados por la BD)
export interface ContactInput {
  email: string | null;       // null cuando solo se tiene teléfono
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  external_id: string | null;
  source: "ghl" | "stripe" | "manual";
  metadata: Record<string, unknown> | null;
}

// Tabla: payments
export interface Payment {
  id: string;
  external_id: string; // ID en Stripe o Flywire
  contact_id: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  provider: "stripe" | "flywire";
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

// Payload para insertar un pago (sin campos generados por la BD)
export interface PaymentInput {
  external_id: string;
  contact_id: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  provider: "stripe" | "flywire";
  invoice_id: string | null;
  metadata: Record<string, unknown> | null;
}

// Tabla: invoices
export interface Invoice {
  id: string;
  external_id: string | null; // ID en Holded
  contact_id: string;
  number: string;
  amount: number;
  currency: string;
  status: "draft" | "issued" | "paid" | "cancelled";
  issued_at: string | null;
  due_at: string | null;
  synced_to_holded: boolean;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

// Tabla: subscriptions
export interface Subscription {
  id: string;
  external_id: string; // ID en Stripe
  contact_id: string;
  status: "active" | "inactive" | "cancelled" | "past_due";
  plan_id: string | null;
  amount: number;
  currency: string;
  next_billing_date: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

// Tabla: events_log
export interface EventLog {
  id: string;
  webhook_source: "ghl" | "stripe" | "flywire" | "holded" | "manual";
  external_event_id: string; // ID único del evento en la plataforma externa
  event_type: string; // ej: "contact.created", "payment_intent.succeeded"
  status: "received" | "processed" | "failed";
  payload: Record<string, unknown>;
  error_message: string | null;
  idempotency_key: string; // Para detectar duplicados
  created_at: string;
  processed_at: string | null;
}

// Payload para insertar un evento (sin campos generados por la BD)
export interface EventLogInput {
  webhook_source: "ghl" | "stripe" | "flywire" | "holded" | "manual";
  external_event_id: string;
  event_type: string;
  status: "received" | "processed" | "failed";
  payload: Record<string, unknown>;
  error_message: string | null;
  idempotency_key: string;
  processed_at: string | null;
}

// Tabla: opportunities
export interface Opportunity {
  id: string;
  external_id: string;           // GHL opportunity id
  contact_id: string;
  name: string;
  pipeline_id: string;
  pipeline_name: string | null;
  stage_id: string;
  stage_name: string | null;
  status: string;                // open | won | lost | abandoned (stored as-is from GHL)
  monetary_value: number | null;
  currency: string;
  assigned_to: string | null;
  last_stage_change_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

// Payload para insertar/actualizar una oportunidad (sin campos generados por la BD)
export interface OpportunityInput {
  external_id: string;
  contact_id: string;
  name: string;
  pipeline_id: string;
  pipeline_name: string | null;
  stage_id: string;
  stage_name: string | null;
  status: string;
  monetary_value: number | null;
  currency: string;
  assigned_to: string | null;
  last_stage_change_at: string | null;
  metadata: Record<string, unknown> | null;
}

// Tabla: opportunity_stage_history
export interface OpportunityStageHistory {
  id: string;
  opportunity_id: string;
  from_stage_id: string | null;
  from_stage_name: string | null;
  to_stage_id: string;
  to_stage_name: string | null;
  status: string;
  monetary_value: number | null;
  moved_at: string;
  ghl_event_id: string | null;
}

// Payload para insertar una entrada en el historial de etapas
export interface OpportunityStageHistoryInput {
  opportunity_id: string;
  from_stage_id: string | null;
  from_stage_name: string | null;
  to_stage_id: string;
  to_stage_name: string | null;
  status: string;
  monetary_value: number | null;
  moved_at: string;
  ghl_event_id: string | null;
}

// Tabla: payment_alerts
export interface PaymentAlert {
  id:               string;
  payment_id:       string;
  rule_code:        string;
  severity:         "critical" | "warning";
  status:           "open" | "resolved" | "dismissed";
  message:          string;
  context:          Record<string, unknown>;
  detected_at:      string;
  closed_at:        string | null;
  resolution_notes: string | null;
}

// Payload para insertar una alerta (sin campos generados por la BD)
export interface PaymentAlertInput {
  payment_id: string;
  rule_code:  string;
  severity:   "critical" | "warning";
  message:    string;
  context:    Record<string, unknown>;
}

// Tabla: sync_queue
export interface SyncQueueItem {
  id: string;
  entity_type: "invoice" | "contact" | "payment";
  entity_id: string;
  target_system: "holded" | "stripe";
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "succeeded" | "failed";
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}