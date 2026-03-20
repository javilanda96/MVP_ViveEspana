import { supabase } from "../lib/supabase.js";
import type { PaymentAlertInput } from "../types/models.js";

/**
 * Inserta una alerta operativa de pago en payment_alerts.
 *
 * ON CONFLICT (payment_id, rule_code) DO NOTHING: si ya existe una alerta
 * para el mismo pago y la misma regla, la inserción se ignora silenciosamente.
 * Garantiza idempotencia ante reprocesamiento del mismo webhook.
 *
 * Lanza solo ante errores de BD reales (nunca ante conflictos de unicidad).
 */
export async function insertPaymentAlert(data: PaymentAlertInput): Promise<void> {
  const { error } = await supabase
    .from("payment_alerts")
    .upsert(data, { onConflict: "payment_id,rule_code", ignoreDuplicates: true });

  if (error) {
    throw new Error(`[alert.repository] DB insert failed: ${error.message}`);
  }
}
