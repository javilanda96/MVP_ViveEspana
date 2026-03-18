/**
 * Connection resolver — DB-first, fallback-compatible.
 *
 * Tries to load active connections from the `connections` table.
 * If the query fails or returns no rows (e.g. migration not yet applied,
 * DB unreachable, or table empty), returns the caller-supplied fallback
 * unchanged — preserving existing behaviour exactly.
 *
 * The caller (admin.repository.ts) passes INTEGRATION_DESCRIPTORS as the
 * fallback, so that array remains the single source of fallback truth and
 * is not duplicated here.
 */

import { supabase } from "./supabase.js";

export interface ResolvedConnection {
  name:      string;
  source:    string;
  eventType: string; // maps to event_type in DB / eventType in INTEGRATION_DESCRIPTORS
  endpoint:  string;
  authType:  string; // maps to auth_type in DB  / authType in INTEGRATION_DESCRIPTORS
  secretKey: string; // used to look up secretPresenceMap in the caller
}

/**
 * Returns enabled connections from the DB, mapped to ResolvedConnection.
 * Falls back to `fallback` on any error or empty result.
 */
export async function resolveConnections(
  fallback: ResolvedConnection[]
): Promise<ResolvedConnection[]> {
  try {
    const { data, error } = await supabase
      .from("connections")
      .select("name, source, event_type, endpoint, auth_type")
      .eq("enabled", true)
      .order("created_at");

    if (error || !data || data.length === 0) return fallback;

    return data.map(row => ({
      name:      row.name       as string,
      source:    row.source     as string,
      eventType: row.event_type as string,
      endpoint:  row.endpoint   as string,
      authType:  row.auth_type  as string,
      secretKey: row.source     as string, // ghl→ghlSecret, stripe→stripeSecret; others resolve to false
    }));
  } catch {
    return fallback;
  }
}
