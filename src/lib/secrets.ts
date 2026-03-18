/**
 * Single access point for all sensitive runtime secrets.
 *
 * TODAY:  reads from process.env (set via .env / host environment).
 * FUTURE: to migrate to database or Vault-backed storage, replace the
 *         body of each getter here — callers throughout the app are
 *         unaffected because they import named functions, not process.env.
 *
 * Rules:
 *   - Only this file may read secret env vars (SUPABASE_*, *_SECRET, *_KEY).
 *   - No business logic lives here — only secret retrieval.
 *   - PORT and NODE_ENV are non-sensitive config; they stay in config.ts.
 *   - This file must never be imported by dashboard (browser) code.
 */

/** Supabase project URL — required at startup. */
export function getSupabaseUrl(): string {
  const v = process.env.SUPABASE_URL;
  if (!v) throw new Error("SUPABASE_URL is required");
  return v;
}

/** Supabase service-role key — required at startup. Never expose to clients. */
export function getSupabaseServiceKey(): string {
  const v = process.env.SUPABASE_SERVICE_KEY;
  if (!v) throw new Error("SUPABASE_SERVICE_KEY is required");
  return v;
}

/**
 * Admin dashboard API key.
 * Returns undefined in dev when not set — disables login (non-fatal).
 * Required in production (enforced by config.ts validateEnv).
 */
export function getAdminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY || undefined;
}

/**
 * GHL shared-secret webhook verification value.
 * Returns undefined → permissive dev mode (requests pass through with a warning).
 * Required in production (enforced by config.ts validateEnv).
 */
export function getGhlWebhookSecret(): string | undefined {
  return process.env.GHL_WEBHOOK_SECRET || undefined;
}

/**
 * Stripe webhook signing secret for HMAC-SHA256 verification.
 * Returns undefined → permissive dev mode (requests pass through with a warning).
 * Required in production (enforced by config.ts validateEnv).
 */
export function getStripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET || undefined;
}
