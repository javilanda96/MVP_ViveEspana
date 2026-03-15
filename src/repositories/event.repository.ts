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

/**
 * Check whether a webhook event has already been successfully processed.
 *
 * Queries events_log for a row where external_event_id matches the given
 * Stripe event id (evt_xxx) and status is "processed".
 *
 * Fails open: returns false on any DB error so the event is processed
 * rather than silently dropped.
 */
export async function isEventAlreadyLogged(
  externalEventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("events_log")
    .select("id")
    .eq("external_event_id", externalEventId)
    .eq("status", "processed")
    .maybeSingle();

  if (error) {
    console.error(
      `[event.repository] isEventAlreadyLogged failed: ${error.message}`
    );
    return false; // fail open: process the event rather than silently drop it
  }

  return data !== null;
}
