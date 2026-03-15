import { createHmac, timingSafeEqual } from "node:crypto";

// ─── Stripe ───────────────────────────────────────────────────────────────────

const STRIPE_TOLERANCE_SECONDS = 300; // reject events older than 5 minutes

/**
 * Verify a Stripe webhook signature.
 *
 * Header format:  Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>]
 *
 * Algorithm:
 *   signed_payload = `${t}.${rawBody}`
 *   expected       = HMAC-SHA256(signed_payload, secret) → hex
 *   valid          = any v1 value matches expected (constant-time)
 *
 * Returns false on ANY error — callers treat false as 401.
 * Never throws.
 */
export function verifyStripeSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  try {
    // Parse header pairs, handling values that may contain "="
    const items = signatureHeader.split(",").map((item) => {
      const eqIdx = item.indexOf("=");
      return [item.slice(0, eqIdx).trim(), item.slice(eqIdx + 1).trim()] as [
        string,
        string,
      ];
    });

    const timestamp = items.find(([k]) => k === "t")?.[1];
    const v1Sigs    = items.filter(([k]) => k === "v1").map(([, v]) => v);

    if (!timestamp || v1Sigs.length === 0) return false;

    // Reject stale or future-dated webhooks
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (age > STRIPE_TOLERANCE_SECONDS || age < -STRIPE_TOLERANCE_SECONDS) {
      return false;
    }

    const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
    const expected      = createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");

    const expectedBuf = Buffer.from(expected, "utf8");

    // At least one v1 must match (Stripe sends multiple during key rotation)
    return v1Sigs.some((v1) => {
      const receivedBuf = Buffer.from(v1, "utf8");
      if (expectedBuf.length !== receivedBuf.length) return false;
      return timingSafeEqual(expectedBuf, receivedBuf);
    });
  } catch {
    return false;
  }
}

// ─── GoHighLevel ──────────────────────────────────────────────────────────────

/**
 * Verify a GoHighLevel shared-secret header.
 *
 * GHL does not offer HMAC-signed payloads in its standard webhook feature.
 * We protect the endpoint with a pre-shared secret in X-GHL-Signature.
 * Constant-time comparison prevents timing-based brute-force.
 *
 * Returns false on ANY error — callers treat false as 401.
 * Never throws.
 */
export function verifyGhlSecret(
  receivedHeaderValue: string,
  secret: string
): boolean {
  try {
    const expectedBuf = Buffer.from(secret,              "utf8");
    const receivedBuf = Buffer.from(receivedHeaderValue, "utf8");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
