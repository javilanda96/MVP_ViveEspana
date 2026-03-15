import {
  findOpportunityByExternalId,
  upsertOpportunity,
  insertStageHistoryRow,
} from "../repositories/opportunity.repository.js";
import { insertEventLog, isEventAlreadyLogged } from "../repositories/event.repository.js";
import type { Opportunity, OpportunityInput } from "../types/models.js";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

/**
 * Shape expected from the GHL webhook body after schema validation.
 *
 * Field names match GHL's payload conventions (camelCase for GHL-native fields).
 * The route handler passes `request.body` directly as this type.
 */
export interface OpportunityPayload {
  // ── Identifiers ────────────────────────────────────────────────────────────
  event_id?:    string;   // GHL webhook envelope id — used for event-level idempotency
  id?:          string;   // GHL opportunity id (camelCase field from GHL)
  external_id?: string;   // snake_case alias — accepted for API-style senders

  // ── Contact linkage ────────────────────────────────────────────────────────
  contact_id?:    string; // Internal UUID if the contact already exists in our DB
  contactId?:     string; // GHL camelCase variant
  contact_email?: string; // Fallback — resolve contact from email

  // ── Opportunity data ───────────────────────────────────────────────────────
  name?:            string;
  title?:           string;   // GHL sometimes uses "title" instead of "name"
  pipeline_id?:     string;
  pipelineId?:      string;
  pipeline_name?:   string;
  pipelineName?:    string;
  stage_id?:        string;
  stageId?:         string;
  stage_name?:      string;
  stageName?:       string;
  status?:          string;
  monetary_value?:  number;
  monetaryValue?:   number;
  currency?:        string;
  assigned_to?:     string;
  assignedTo?:      string;

  // ── Timestamps ─────────────────────────────────────────────────────────────
  last_stage_change_at?: string;
  lastStageChangeAt?:    string;

  // ── Extra ──────────────────────────────────────────────────────────────────
  metadata?: Record<string, unknown>;
}

// ─── Errores ──────────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class DuplicateEventError extends Error {
  constructor(eventId: string) {
    super(`GHL event already processed: ${eventId}`);
    this.name = "DuplicateEventError";
  }
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export async function processOpportunity(
  payload: OpportunityPayload,
  rawPayload: Record<string, unknown>
): Promise<Opportunity> {

  // ── Field normalisation ───────────────────────────────────────────────────
  // GHL sends camelCase; our DB uses snake_case. Accept both and prefer
  // snake_case when both are present (makes the service API-friendly too).

  const externalId =
    payload.external_id ?? payload.id ?? null;

  const resolvedName =
    payload.name ?? payload.title ?? null;

  const pipelineId =
    payload.pipeline_id ?? payload.pipelineId ?? null;

  const pipelineName =
    payload.pipeline_name ?? payload.pipelineName ?? null;

  const stageId =
    payload.stage_id ?? payload.stageId ?? null;

  const stageName =
    payload.stage_name ?? payload.stageName ?? null;

  const monetaryValue =
    payload.monetary_value ?? payload.monetaryValue ?? null;

  const assignedTo =
    payload.assigned_to ?? payload.assignedTo ?? null;

  const lastStageChangeAt =
    payload.last_stage_change_at ?? payload.lastStageChangeAt ?? null;

  const contactId =
    payload.contact_id ?? payload.contactId ?? null;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!externalId) {
    throw new ValidationError("Opportunity payload must include an id or external_id");
  }
  if (!resolvedName) {
    throw new ValidationError("Opportunity payload must include a name or title");
  }
  if (!pipelineId) {
    throw new ValidationError("Opportunity payload must include a pipeline_id or pipelineId");
  }
  if (!stageId) {
    throw new ValidationError("Opportunity payload must include a stage_id or stageId");
  }
  if (!payload.status) {
    throw new ValidationError("Opportunity payload must include a status");
  }
  if (!contactId && !payload.contact_email) {
    throw new ValidationError(
      "Opportunity payload must include at least one of: contact_id, contactId, contact_email"
    );
  }

  // ── Idempotency keys ──────────────────────────────────────────────────────
  const idempotencyKey  = externalId;
  const externalEventId = payload.event_id ?? externalId;
  const webhookSource   = "ghl" as const;

  // ── Event-level idempotency ───────────────────────────────────────────────
  // If GHL resends the same event id, short-circuit before any DB write.
  if (payload.event_id) {
    const alreadyProcessed = await isEventAlreadyLogged(payload.event_id);
    if (alreadyProcessed) {
      throw new DuplicateEventError(payload.event_id);
    }
  }

  // ── Contact resolution ────────────────────────────────────────────────────
  // contact_id from the payload is trusted directly (GHL sends its own UUID
  // for the contact). If absent, we would need to look up by email — for now
  // we require at least one of the two so the FK can be populated.
  //
  // NOTE: We do NOT do a DB lookup by email here because GHL webhooks always
  // include the contactId field. The contact_email fallback is kept for
  // API-style callers that test the endpoint manually.
  if (!contactId) {
    await insertEventLog({
      webhook_source:    webhookSource,
      external_event_id: externalEventId,
      event_type:        "opportunity.updated",
      status:            "failed",
      payload:           rawPayload,
      error_message:     "contact_id missing and email lookup not supported yet",
      idempotency_key:   idempotencyKey,
      processed_at:      new Date().toISOString(),
    });
    throw new ValidationError(
      "contact_id or contactId is required (email-based lookup not yet implemented)"
    );
  }

  // ── Fetch existing opportunity (for stage-change detection) ───────────────
  let previousOpportunity: Opportunity | null = null;
  try {
    previousOpportunity = await findOpportunityByExternalId(externalId);
  } catch {
    // Non-fatal: if we can't read the previous state we skip history insertion
  }

  // ── Build upsert record ───────────────────────────────────────────────────
  const record: OpportunityInput = {
    external_id:          externalId,
    contact_id:           contactId,
    name:                 resolvedName,
    pipeline_id:          pipelineId,
    pipeline_name:        pipelineName,
    stage_id:             stageId,
    stage_name:           stageName,
    status:               payload.status,
    monetary_value:       monetaryValue,
    currency:             (payload.currency ?? "EUR").toUpperCase(),
    assigned_to:          assignedTo,
    last_stage_change_at: lastStageChangeAt,
    metadata:             payload.metadata ?? null,
  };

  // ── Upsert opportunity ────────────────────────────────────────────────────
  let opportunity: Opportunity;

  try {
    opportunity = await upsertOpportunity(record);
  } catch (err) {
    await insertEventLog({
      webhook_source:    webhookSource,
      external_event_id: externalEventId,
      event_type:        "opportunity.updated",
      status:            "failed",
      payload:           rawPayload,
      error_message:     err instanceof Error ? err.message : String(err),
      idempotency_key:   idempotencyKey,
      processed_at:      new Date().toISOString(),
    });
    throw err;
  }

  // ── Stage / status history ────────────────────────────────────────────────
  // Only write a history row when the stage or status actually changed.
  // This prevents duplicate history rows when GHL retries the same event.
  const stageChanged =
    previousOpportunity === null ||
    previousOpportunity.stage_id !== stageId ||
    previousOpportunity.status  !== payload.status;

  if (stageChanged) {
    // insertStageHistoryRow is non-throwing — failure is logged but does not
    // roll back the upsert that already succeeded.
    await insertStageHistoryRow({
      opportunity_id:  opportunity.id,
      from_stage_id:   previousOpportunity?.stage_id   ?? null,
      from_stage_name: previousOpportunity?.stage_name ?? null,
      to_stage_id:     stageId,
      to_stage_name:   stageName,
      status:          payload.status,
      monetary_value:  monetaryValue,
      moved_at:        lastStageChangeAt ?? new Date().toISOString(),
      ghl_event_id:    payload.event_id ?? null,
    });
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  await insertEventLog({
    webhook_source:    webhookSource,
    external_event_id: externalEventId,
    event_type:        "opportunity.updated",
    status:            "processed",
    payload:           rawPayload,
    error_message:     null,
    idempotency_key:   idempotencyKey,
    processed_at:      new Date().toISOString(),
  });

  return opportunity;
}
