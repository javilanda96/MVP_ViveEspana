import {
  findOpportunityByExternalId,
  upsertOpportunity,
  insertStageHistoryRow,
} from "../repositories/opportunity.repository.js";
import { insertEventLog, isEventAlreadyLogged } from "../repositories/event.repository.js";
import { findContactByEmail } from "../repositories/contact.repository.js";
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

  // ── GHL real webhook fields ────────────────────────────────────────────────
  // These come directly from observed GHL payloads. Normalised to internal
  // names in processOpportunity() — not used at route level.
  opportunity_name?: string;  // GHL sends the title here, not in "name"
  email?: string;             // GHL sends contact email as "email", not "contact_email"
  pipleline_stage?: string;   // GHL typo (sic) — stage label; stage_id is never sent
  phone?: string;             // present in GHL payload; carried to metadata

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
    payload.name ?? payload.title ?? payload.opportunity_name ?? null;

  const pipelineId =
    payload.pipeline_id ?? payload.pipelineId ?? null;

  const pipelineName =
    payload.pipeline_name ?? payload.pipelineName ?? null;

  // pipleline_stage (GHL typo) carries the stage label; stage_id is never
  // present in real GHL payloads so we fall back to stageName as a synthetic
  // id — satisfies the NOT NULL DB column without blocking MVP processing.
  const stageName =
    payload.stage_name ?? payload.stageName ?? payload.pipleline_stage ?? null;

  const stageId =
    payload.stage_id ?? payload.stageId ?? stageName ?? null;

  const monetaryValue =
    payload.monetary_value ?? payload.monetaryValue ?? null;

  const assignedTo =
    payload.assigned_to ?? payload.assignedTo ?? null;

  const lastStageChangeAt =
    payload.last_stage_change_at ?? payload.lastStageChangeAt ?? null;

  // GHL sends its own alphanumeric contact id (e.g. "B6rgLqjjEO9MfcxLk07k"),
  // not a Supabase UUID. Detect this early and treat such values as untrusted
  // so we fall through to email-based contact lookup below.
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawContactId = payload.contact_id ?? payload.contactId ?? null;
  const contactId    = rawContactId !== null && UUID_REGEX.test(rawContactId)
    ? rawContactId
    : null;

  // GHL sends contact email as "email"; internal callers use "contact_email".
  const contactEmail = payload.contact_email ?? payload.email ?? null;

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
    throw new ValidationError(
      "Opportunity payload must include a stage_id, stageId, stage_name, or pipleline_stage"
    );
  }
  if (!payload.status) {
    throw new ValidationError("Opportunity payload must include a status");
  }
  if (!contactId && !contactEmail) {
    throw new ValidationError(
      "Opportunity payload must include at least one of: contact_id, contactId, contact_email, email"
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
  // Real GHL payloads always include contact_id but it is GHL's own
  // alphanumeric id, not a Supabase UUID. The UUID check above already
  // discarded it (contactId = null), so we always fall through to email
  // lookup for GHL-originated webhooks. Internal API callers that already
  // have our UUID can pass it directly and skip the lookup.
  let resolvedContactId = contactId;

  if (!resolvedContactId) {
    if (!contactEmail) {
      await insertEventLog({
        webhook_source:    webhookSource,
        external_event_id: externalEventId,
        event_type:        "opportunity.updated",
        status:            "failed",
        payload:           rawPayload,
        error_message:     "contact_id is not a valid Supabase UUID and no email provided for fallback lookup",
        idempotency_key:   idempotencyKey,
        processed_at:      new Date().toISOString(),
      });
      throw new ValidationError(
        "contact_id is not a Supabase UUID; provide email or contact_email for contact lookup"
      );
    }

    const contact = await findContactByEmail(contactEmail);
    if (!contact) {
      await insertEventLog({
        webhook_source:    webhookSource,
        external_event_id: externalEventId,
        event_type:        "opportunity.updated",
        status:            "failed",
        payload:           rawPayload,
        error_message:     `No contact found with email: ${contactEmail}`,
        idempotency_key:   idempotencyKey,
        processed_at:      new Date().toISOString(),
      });
      throw new ValidationError(`No contact found with email: ${contactEmail}`);
    }

    resolvedContactId = contact.id;
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
    contact_id:           resolvedContactId!,
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
