import { upsertContact } from "../repositories/contact.repository.js";
import { insertEventLog } from "../repositories/event.repository.js";
import type { Contact, ContactInput } from "../types/models.js";

// ─── Tipos públicos ───────────────────────────────────────────────────────────
//
// Acepta tanto el formato interno (snake_case) como los campos nativos de
// GoHighLevel (camelCase). Ambos son opcionales y se fusionan en la
// normalización, de modo que los tests manuales existentes siguen funcionando.

export interface ContactPayload {
  // Campos compartidos (formato interno y GHL)
  email?: string;
  phone?: string;

  // Nombre: formato interno (snake_case)
  first_name?: string;
  last_name?: string;
  name?: string;           // nombre completo, para splitting si no hay first/last

  // Nombre: formato GHL (camelCase) — mapeados a first_name / last_name
  firstName?: string;
  lastName?: string;

  // ID externo: formato interno
  external_id?: string;
  // ID externo: formato GHL — mapeado a external_id
  id?: string;

  // Metadatos opcionales
  source?: "ghl" | "stripe" | "manual";
  metadata?: Record<string, unknown>;
}

// ─── Errores ──────────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export async function processContact(
  payload: ContactPayload,
  rawPayload: Record<string, unknown>
): Promise<Contact> {
  // ── Validación ────────────────────────────────────────────────────────────────
  //
  // Al menos un identificador de contacto es obligatorio.
  // El mensaje especifica exactamente qué campos acepta para facilitar el
  // diagnóstico cuando llega un webhook mal configurado.
  if (!payload.email && !payload.phone) {
    throw new ValidationError(
      "Payload must include at least one of: email, phone"
    );
  }

  // ── Normalización del nombre ──────────────────────────────────────────────────
  //
  // Prioridad para first_name:
  //   1. payload.first_name  (formato interno)
  //   2. payload.firstName   (formato GHL)
  //   3. primer token de payload.name
  //   4. null
  const first_name =
    payload.first_name ??
    payload.firstName ??
    (payload.name ? payload.name.split(" ")[0] : null) ??
    null;

  // Prioridad para last_name:
  //   1. payload.last_name   (formato interno)
  //   2. payload.lastName    (formato GHL)
  //   3. resto de tokens de payload.name
  //   4. null
  const last_name =
    payload.last_name ??
    payload.lastName ??
    (payload.name && payload.name.includes(" ")
      ? payload.name.split(" ").slice(1).join(" ")
      : null) ??
    null;

  // ── Normalización del ID externo ──────────────────────────────────────────────
  //
  // Prioridad:
  //   1. payload.external_id  (formato interno)
  //   2. payload.id           (formato GHL: campo "id" del contacto)
  //   3. null
  const external_id = payload.external_id ?? payload.id ?? null;

  // ── Registro a persistir ──────────────────────────────────────────────────────
  const record: ContactInput = {
    email:       payload.email    ?? null,
    first_name,
    last_name,
    phone:       payload.phone    ?? null,
    external_id,
    source:      payload.source   ?? "manual",
    metadata:    payload.metadata ?? null,
  };

  // ── Clave de idempotencia: email tiene prioridad, luego phone ─────────────────
  const idempotencyKey = payload.email ?? payload.phone ?? "unknown";

  // ── ID externo del evento: external_id normalizado si existe, si no idempotencyKey
  const externalEventId = external_id ?? idempotencyKey;

  // ── Columna de conflicto para el upsert ───────────────────────────────────────
  const onConflict: "email" | "phone" = payload.email ? "email" : "phone";

  // ── Upsert + log de evento ────────────────────────────────────────────────────
  let contact: Contact;

  try {
    contact = await upsertContact(record, onConflict);
  } catch (err) {
    await insertEventLog({
      webhook_source:    payload.source ?? "manual",
      external_event_id: externalEventId,
      event_type:        "contact.upsert",
      status:            "failed",
      payload:           rawPayload,
      error_message:     err instanceof Error ? err.message : String(err),
      idempotency_key:   idempotencyKey,
      processed_at:      new Date().toISOString(),
    });

    throw err;
  }

  await insertEventLog({
    webhook_source:    payload.source ?? "manual",
    external_event_id: externalEventId,
    event_type:        "contact.upsert",
    status:            "processed",
    payload:           rawPayload,
    error_message:     null,
    idempotency_key:   idempotencyKey,
    processed_at:      new Date().toISOString(),
  });

  return contact;
}
