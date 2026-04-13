import { supabase } from "../lib/supabase.js";
import type { Payment, PaymentInput } from "../types/models.js";

/**
 * Insert a new payment record.
 *
 * Returns null when the insert is rejected by the unique constraint
 * (external_id + provider duplicate). All other DB errors are thrown.
 */
export async function insertPayment(
  data: PaymentInput
): Promise<Payment | null> {
  const { data: result, error } = await supabase
    .from("payments")
    .insert(data)
    .select()
    .single();

  if (error) {
    // Postgres unique violation — signal duplicate to caller, do not throw
    if (error.code === "23505") {
      return null;
    }
    throw new Error(`DB insert failed: ${error.message}`);
  }

  return result as Payment;
}

