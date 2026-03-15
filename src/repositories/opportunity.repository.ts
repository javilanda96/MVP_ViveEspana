import { supabase } from "../lib/supabase.js";
import type {
  Opportunity,
  OpportunityInput,
  OpportunityStageHistoryInput,
} from "../types/models.js";

/**
 * Look up an opportunity by its GHL external_id.
 *
 * Returns null (not throws) when no row is found.
 */
export async function findOpportunityByExternalId(
  externalId: string
): Promise<Opportunity | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("external_id", externalId)
    .maybeSingle();

  if (error) {
    throw new Error(`DB lookup failed: ${error.message}`);
  }

  return data as Opportunity | null;
}

/**
 * Insert or update an opportunity row.
 *
 * Uses upsert on the external_id unique constraint so GHL retries are
 * idempotent — the row is updated in place rather than duplicated.
 */
export async function upsertOpportunity(
  data: OpportunityInput
): Promise<Opportunity> {
  const { data: result, error } = await supabase
    .from("opportunities")
    .upsert(data, { onConflict: "external_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`DB upsert failed: ${error.message}`);
  }

  return result as Opportunity;
}

/**
 * Append a row to opportunity_stage_history.
 *
 * Intentionally non-throwing: a history write failure must not roll back
 * the opportunity upsert. Errors are logged to stderr and swallowed.
 */
export async function insertStageHistoryRow(
  data: OpportunityStageHistoryInput
): Promise<void> {
  const { error } = await supabase
    .from("opportunity_stage_history")
    .insert(data);

  if (error) {
    console.error(
      `[opportunity.repository] Failed to insert stage history: ${error.message}`
    );
  }
}
