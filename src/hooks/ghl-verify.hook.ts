import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyGhlSecret } from "../lib/webhook-security.js";
import { config } from "../config.js";

const GHL_SIGNATURE_HEADER = "x-ghl-signature" as const;

/**
 * Fastify preHandler — GoHighLevel shared-secret verification.
 *
 * Permissive dev mode:  GHL_WEBHOOK_SECRET not set → request passes through
 *                       with a warning log. Enables local testing without secrets.
 *
 * Production mode:      missing or invalid X-GHL-Signature header → 401.
 *
 * GHL configuration: add a custom header X-GHL-Signature: <your-secret>
 * in the GoHighLevel webhook settings for this endpoint.
 */
export async function ghlVerifyHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const secret = config.webhooks.ghlSecret;

  // ── Permissive dev mode ───────────────────────────────────────────────────
  if (!secret) {
    request.log.warn(
      "GHL_WEBHOOK_SECRET is not set — running in permissive dev mode"
    );
    return;
  }

  // ── Signature header check ────────────────────────────────────────────────
  const headerValue = request.headers[GHL_SIGNATURE_HEADER];

  if (!headerValue || typeof headerValue !== "string") {
    await reply
      .status(401)
      .send({ error: `Missing ${GHL_SIGNATURE_HEADER} header` });
    return;
  }

  // ── Constant-time comparison ──────────────────────────────────────────────
  const valid = verifyGhlSecret(headerValue, secret);

  if (!valid) {
    request.log.warn("GHL signature verification failed — request rejected");
    await reply.status(401).send({ error: "Invalid webhook signature" });
    return;
  }
}
