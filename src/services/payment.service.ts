import {
  insertPayment,
  findContactByEmail,
} from "../repositories/payment.repository.js";
import { insertEventLog } from "../repositories/event.repository.js";
import type { Payment, PaymentInput } from "../types/models.js";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface PaymentPayload {
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

// ─── Servicio ─────────────────────────────────────────────────────────────────

export async function processPayment(
  payload: PaymentPayload,
  rawPayload: Record<string, unknown>
): Promise<Payment> {
  // ── Validación de campos obligatorios ─────────────────────────────────────────
  // These checks run before we can build an event log entry (external_id may be
  // missing), so they throw without logging. Pure input errors from the sender.
  if (!payload.external_id) {
    throw new ValidationError("external_id is required");
  }
  if (typeof payload.amount !== "number" || payload.amount <= 0) {
    throw new ValidationError("amount must be a positive number");
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
  const webhookSource = payload.provider === "stripe" ? "stripe" : "flywire";
  const idempotencyKey = payload.external_id;

  // ── Resolución del contacto ───────────────────────────────────────────────────
  let contactId = payload.contact_id;

  if (!contactId) {
    const contact = await findContactByEmail(payload.contact_email!);

    if (!contact) {
      // Log the failed attempt before returning the error to the caller
      const errorMessage = `No contact found with email: ${payload.contact_email}`;
      await insertEventLog({
        webhook_source:    webhookSource,
        external_event_id: payload.external_id,
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
      external_event_id: payload.external_id,
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

  await insertEventLog({
    webhook_source:    webhookSource,
    external_event_id: payload.external_id,
    event_type:        "payment.created",
    status:            "processed",
    payload:           rawPayload,
    error_message:     null,
    idempotency_key:   idempotencyKey,
    processed_at:      new Date().toISOString(),
  });

  return payment;
}
