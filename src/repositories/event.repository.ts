import { supabase } from "../lib/supabase.js";
import type { EventLogInput } from "../types/models.js";

/**
 * Persist a webhook event to events_log.
 *
 * Intencionalmente no lanza: un fallo de auditoría no debe
 * interrumpir el flujo principal.
 */
export async function insertEventLog(data: EventLogInput): Promise<void> {
  const { error } = await supabase.from("events_log").insert(data);

  if (error) {
    // Surface in logs but do not propagate
    console.error(`[event.repository] Failed to log event: ${error.message}`);
  }
}
