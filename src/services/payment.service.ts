import { insertPayment } from "../repositories/payment.repository.js";
import { findContactByEmail } from "../repositories/contact.repository.js";
import { insertEventLog, isEventAlreadyLogged } from "../repositories/event.repository.js";
import { evaluatePaymentAlerts } from "./alert.service.js";
import type { Payment, PaymentInput } from "../types/models.js";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface PaymentPayload {
  event_id?: string;         // Stripe envelope id (evt_xxx) — used for webhook-level idempotency
  external_id: string;
  contact_id?: string;
  contact_email?: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  provider: "stripe" | "flywire";
  invoice_id?: string;
  metadata?: Record<string, unknown>;
}

// ─── Errores ──────────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class DuplicatePaymentError extends Error {
  constructor(externalId: string) {
    super(`Duplicate payment ignored: ${externalId}`);
    this.name = "DuplicatePaymentError";
  }
}

export class DuplicateEventError extends Error {
  constructor(eventId: string) {
    super(`Stripe event already processed: ${eventId}`);
    this.name = "DuplicateEventError";
  }
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export async function processPayment(
  payload: PaymentPayload,
  rawPayload: Record<string, unknown>
): Promise<Payment> {
  // ── Validación de campos obligatorios ─────────────────────────────────────────
  // These checks run before webhook context (source, idempotency key) can be
  // established, so they throw without logging. Pure structural input errors.
  // NOTE: amount is intentionally NOT checked here — see post-idempotency block.
  if (!payload.external_id) {
    throw new ValidationError("external_id is required");
  }
  if (!payload.currency) {
    throw new ValidationError("currency is required");
  }
  if (!payload.status) {
    throw new ValidationError(
      "status is required: pending | succeeded | failed | refunded"
    );
  }
  if (!payload.provider) {
    throw new ValidationError("provider is required: stripe | flywire");
  }
  if (!payload.contact_id && !payload.contact_email) {
    throw new ValidationError(
      "Payload must include at least one of: contact_id, contact_email"
    );
  }

  // ── Fuente y clave de idempotencia ────────────────────────────────────────────
  // Defined here so they are available for ALL event log calls below,
  // including the failed-contact case.
  const webhookSource  = payload.provider === "stripe" ? "stripe" : "flywire";
  const idempotencyKey = payload.external_id;

  // external_event_id: prefer the Stripe envelope event id (evt_xxx) over the
  // payment id so events_log rows are keyed by the canonical Stripe event.
  const externalEventId = payload.event_id ?? payload.external_id;

  // ── Idempotencia a nivel de evento ────────────────────────────────────────────
  // If the caller supplied a Stripe event id, check whether it was already
  // successfully processed. Return early without re-inserting or re-logging.
  // Fails open on DB error: if the check itself fails, we process the event.
  if (payload.event_id) {
    const alreadyProcessed = await isEventAlreadyLogged(payload.event_id);
    if (alreadyProcessed) {
      throw new DuplicateEventError(payload.event_id);
    }
  }

  // ── Validación de importe (con trazabilidad en events_log) ────────────────────
  // Positioned after webhook context is established so that rejected-amount
  // payloads produce a queryable events_log row (status = "failed"), giving
  // operations a persistent signal equivalent to the contact-not-found case.
  // The Fastify schema guarantees amount is a number; this guard catches
  // zero and negative values that JSON schema type validation cannot reject.
  if (payload.amount <= 0) {
    const errorMessage = "amount must be a positive number";
    await insertEventLog({
      webhook_source:    webhookSource,
      external_event_id: externalEventId,
      event_type:        "payment.created",
      status:            "failed",
      payload:           rawPayload,
      error_message:     errorMessage,
      idempotency_key:   idempotencyKey,
      processed_at:      new Date().toISOString(),
    });
    throw new ValidationError(errorMessage);
  }

  // ── Resolución del contacto ───────────────────────────────────────────────────
  let contactId = payload.contact_id;

  if (!contactId) {
    const contact = await findContactByEmail(payload.contact_email!);

    if (!contact) {
      // Log the failed attempt before returning the error to the caller
      const errorMessage = `No contact found with email: ${payload.contact_email}`;
      await insertEventLog({
        webhook_source:    webhookSource,
        external_event_id: externalEventId,
        event_type:        "payment.created",
        status:            "failed",
        payload:           rawPayload,
        error_message:     errorMessage,
        idempotency_key:   idempotencyKey,
        processed_at:      new Date().toISOString(),
      });

      throw new ValidationError(errorMessage);
    }

    contactId = contact.id;
  }

  // ── Registro a persistir ──────────────────────────────────────────────────────
  const record: PaymentInput = {
    external_id: payload.external_id,
    contact_id:  contactId,
    amount:      payload.amount,
    currency:    payload.currency.toUpperCase(),
    status:      payload.status,
    provider:    payload.provider,
    invoice_id:  payload.invoice_id ?? null,
    metadata:    payload.metadata ?? null,
  };

  // ── Insert + log de evento ────────────────────────────────────────────────────
  let payment: Payment | null;

  try {
    payment = await insertPayment(record);
  } catch (err) {
    await insertEventLog({
      webhook_source:    webhookSource,
      external_event_id: externalEventId,
      event_type:        "payment.created",
      status:            "failed",
      payload:           rawPayload,
      error_message:     err instanceof Error ? err.message : String(err),
      idempotency_key:   idempotencyKey,
      processed_at:      new Date().toISOString(),
    });

    throw err;
  }

  // ── Duplicado detectado ───────────────────────────────────────────────────────
  // insertPayment returns null when the DB rejects a duplicate external_id+provider.
  // The original event was already logged when it first succeeded, so we do not
  // write another events_log row. We throw DuplicatePaymentError so the route
  // can return 200 instead of 500.
  if (payment === null) {
    throw new DuplicatePaymentError(payload.external_id);
  }

  // ── Evaluación de alertas operativas ──────────────────────────────────────────
  // Fire-and-forget: un fallo del módulo de alertas no bloquea el flujo principal.
  evaluatePaymentAlerts(payment).catch(err =>
    console.error("[alert.service] evaluatePaymentAlerts failed", { paymentId: payment.id, err })
  );

  await insertEventLog({
    webhook_source:    webhookSource,
    external_event_id: externalEventId,
    event_type:        "payment.created",
    status:            "processed",
    payload:           rawPayload,
    error_message:     null,
    idempotency_key:   idempotencyKey,
    processed_at:      new Date().toISOString(),
  });

  return payment;
}
