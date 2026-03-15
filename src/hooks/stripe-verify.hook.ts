import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyStripeSignature } from "../lib/webhook-security.js";
import { config } from "../config.js";

/**
 * Fastify preHandler — Stripe webhook signature verification.
 *
 * Permissive dev mode:  STRIPE_WEBHOOK_SECRET not set → request passes through
 *                       with a warning log. Enables local testing without secrets.
 *
 * Production mode:      missing or invalid Stripe-Signature header → 401.
 */
export async function stripeVerifyHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const secret = config.webhooks.stripeSecret;

  // ── Permissive dev mode ───────────────────────────────────────────────────
  if (!secret) {
    request.log.warn(
      "STRIPE_WEBHOOK_SECRET is not set — running in permissive dev mode"
    );
    return;
  }

  // ── Signature header check ────────────────────────────────────────────────
  const signatureHeader = request.headers["stripe-signature"];

  if (!signatureHeader || typeof signatureHeader !== "string") {
    await reply
      .status(401)
      .send({ error: "Missing Stripe-Signature header" });
    return;
  }

  // ── Raw body availability check ───────────────────────────────────────────
  // rawBody is populated by the addContentTypeParser in src/index.ts.
  // If it is missing, the parser is not registered correctly.
  if (!request.rawBody) {
    request.log.error(
      "rawBody unavailable — addContentTypeParser not registered correctly"
    );
    await reply.status(500).send({ error: "Server configuration error" });
    return;
  }

  // ── HMAC verification ─────────────────────────────────────────────────────
  const valid = verifyStripeSignature(request.rawBody, signatureHeader, secret);

  if (!valid) {
    request.log.warn("Stripe signature verification failed — request rejected");
    await reply.status(401).send({ error: "Invalid webhook signature" });
    return;
  }
}
