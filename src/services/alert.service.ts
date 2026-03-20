import { insertPaymentAlert } from "../repositories/alert.repository.js";
import type { Payment, PaymentAlertInput } from "../types/models.js";

// ─── Umbrales configurables ───────────────────────────────────────────────────
// Revisar con negocio antes del primer despliegue en producción.

const ALERT_AMOUNT_HIGH_THRESHOLD      = 10_000.00;
const ALERT_AMOUNT_LOW_THRESHOLD       = 1.00;
const ALERT_INVOICE_REQUIRED_THRESHOLD = 500.00;
const ALERT_EXPECTED_CURRENCIES        = ["EUR", "USD", "GBP"] as const;

// ─── Evaluación ───────────────────────────────────────────────────────────────

/**
 * Evalúa el objeto Payment contra las reglas de alerta MVP e inserta en
 * payment_alerts las que se cumplan.
 *
 * Fire-and-forget por diseño: el caller no espera el resultado.
 * Un fallo interno no interrumpe el flujo principal de pagos.
 */
export async function evaluatePaymentAlerts(payment: Payment): Promise<void> {
  const candidates: PaymentAlertInput[] = [];

  // ── Regla 1: AMOUNT_SUSPICIOUSLY_HIGH ────────────────────────────────────────
  if (payment.amount > ALERT_AMOUNT_HIGH_THRESHOLD) {
    candidates.push({
      payment_id: payment.id,
      rule_code:  "AMOUNT_SUSPICIOUSLY_HIGH",
      severity:   "critical",
      message:    `Pago de ${payment.amount} ${payment.currency} supera el umbral máximo (${ALERT_AMOUNT_HIGH_THRESHOLD} ${payment.currency}). Proveedor: ${payment.provider}. ID externo: ${payment.external_id}.`,
      context: {
        amount:         payment.amount,
        currency:       payment.currency,
        provider:       payment.provider,
        external_id:    payment.external_id,
        threshold_used: ALERT_AMOUNT_HIGH_THRESHOLD,
      },
    });
  }

  // ── Regla 2: AMOUNT_SUSPICIOUSLY_LOW ─────────────────────────────────────────
  // payment.amount > 0 está garantizado por payment.service.ts antes de la inserción.
  if (payment.amount < ALERT_AMOUNT_LOW_THRESHOLD) {
    candidates.push({
      payment_id: payment.id,
      rule_code:  "AMOUNT_SUSPICIOUSLY_LOW",
      severity:   "warning",
      message:    `Pago de ${payment.amount} ${payment.currency} está por debajo del umbral mínimo (${ALERT_AMOUNT_LOW_THRESHOLD} ${payment.currency}). Proveedor: ${payment.provider}. ID externo: ${payment.external_id}.`,
      context: {
        amount:         payment.amount,
        currency:       payment.currency,
        provider:       payment.provider,
        external_id:    payment.external_id,
        threshold_used: ALERT_AMOUNT_LOW_THRESHOLD,
      },
    });
  }

  // ── Regla 3: HIGH_AMOUNT_WITHOUT_INVOICE ─────────────────────────────────────
  if (payment.invoice_id === null && payment.amount >= ALERT_INVOICE_REQUIRED_THRESHOLD) {
    candidates.push({
      payment_id: payment.id,
      rule_code:  "HIGH_AMOUNT_WITHOUT_INVOICE",
      severity:   "warning",
      message:    `Pago de ${payment.amount} ${payment.currency} no tiene factura asociada (invoice_id nulo) y supera el umbral que requiere factura (${ALERT_INVOICE_REQUIRED_THRESHOLD} ${payment.currency}). Proveedor: ${payment.provider}.`,
      context: {
        amount:         payment.amount,
        currency:       payment.currency,
        provider:       payment.provider,
        external_id:    payment.external_id,
        invoice_id:     null,
        threshold_used: ALERT_INVOICE_REQUIRED_THRESHOLD,
      },
    });
  }

  // ── Regla 4: UNEXPECTED_CURRENCY ─────────────────────────────────────────────
  if (!(ALERT_EXPECTED_CURRENCIES as readonly string[]).includes(payment.currency)) {
    candidates.push({
      payment_id: payment.id,
      rule_code:  "UNEXPECTED_CURRENCY",
      severity:   "warning",
      message:    `Pago recibido en divisa ${payment.currency}, fuera del conjunto esperado (${ALERT_EXPECTED_CURRENCIES.join(", ")}). Proveedor: ${payment.provider}. Importe: ${payment.amount}.`,
      context: {
        currency:            payment.currency,
        expected_currencies: [...ALERT_EXPECTED_CURRENCIES],
        provider:            payment.provider,
        amount:              payment.amount,
        external_id:         payment.external_id,
      },
    });
  }

  // ── Persistencia y observabilidad ────────────────────────────────────────────
  for (const alert of candidates) {
    // Alertas críticas: emitir log estructurado antes del intento de insert,
    // para que la señal quede registrada aunque el insert falle.
    if (alert.severity === "critical") {
      console.warn("[alert.service] anomaly_alert", {
        anomaly_alert: true,
        rule_code:     alert.rule_code,
        payment_id:    alert.payment_id,
        severity:      "critical",
        amount:        payment.amount,
        currency:      payment.currency,
        provider:      payment.provider,
      });
    }

    await insertPaymentAlert(alert).catch(err => {
      console.error("[alert.service] insertPaymentAlert failed", {
        payment_id: alert.payment_id,
        rule_code:  alert.rule_code,
        err,
      });
    });
  }
}
