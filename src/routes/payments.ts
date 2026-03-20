import type { FastifyInstance } from "fastify";
import {
  processPayment,
  ValidationError,
  DuplicatePaymentError,
  DuplicateEventError,
  type PaymentPayload,
} from "../services/payment.service.js";
import { stripeVerifyHook } from "../hooks/stripe-verify.hook.js";

// ─── JSON Schema ─────────────────────────────────────────────────────────────
//
// Validated by Fastify/ajv before the preHandler runs.
// additionalProperties: true — Stripe may include envelope fields we don't use.
// required enforces the five fields that processPayment() cannot function without.
// anyOf enforces that at least one contact resolver is present; mirrors the
// service-level check so clearly invalid payloads are rejected before any DB call.
const paymentBodySchema = {
  type: "object",
  additionalProperties: true,
  required: ["external_id", "amount", "currency", "status", "provider"],
  anyOf: [
    { required: ["contact_id"] },
    { required: ["contact_email"] },
  ],
  properties: {
    event_id:      { type: "string" },
    external_id:   { type: "string", minLength: 1 },
    contact_id:    { type: "string" },
    contact_email: { type: "string" },
    amount:        { type: "number" },
    currency:      { type: "string", minLength: 1 },
    status:        { type: "string", enum: ["pending", "succeeded", "failed", "refunded"] },
    provider:      { type: "string", enum: ["stripe", "flywire"] },
    invoice_id:    { type: "string" },
    metadata:      { type: "object" },
  },
} as const;

export async function paymentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: PaymentPayload }>(
    "/webhooks/payments",
    { preHandler: stripeVerifyHook, schema: { body: paymentBodySchema } },
    async (request, reply) => {
      const body = request.body;

      // Reject empty payloads
      if (!body || Object.keys(body).length === 0) {
        fastify.log.warn("Payment webhook rejected: empty payload");
        return reply.status(400).send({ error: "Empty payload" });
      }

      // Log the full incoming payload for inspection and debugging
      fastify.log.info({ payload: body }, "Incoming payment webhook");

      try {
        const payment = await processPayment(
          body,
          body as unknown as Record<string, unknown>
        );

        fastify.log.info(
          {
            paymentId: payment.id,
            provider:  payment.provider,
            status:    payment.status,
            amount:    payment.amount,
            currency:  payment.currency,
          },
          "Payment recorded"
        );

        return reply.status(200).send({ status: "ok" });
      } catch (err) {
        if (err instanceof DuplicateEventError) {
          fastify.log.info(
            { event_id: body.event_id },
            "Duplicate Stripe event ignored"
          );
          return reply
            .status(200)
            .send({ status: "ok", message: "duplicate event ignored" });
        }

        if (err instanceof DuplicatePaymentError) {
          fastify.log.info(
            { external_id: body.external_id },
            "Duplicate payment ignored"
          );
          return reply
            .status(200)
            .send({ status: "ok", message: "duplicate ignored" });
        }

        if (err instanceof ValidationError) {
          fastify.log.warn(
            {
              error:       err.message,
              external_id: body.external_id,
              provider:    body.provider,
              amount:      body.amount,
              currency:    body.currency,
            },
            "Payment rejected: validation error"
          );
          return reply.status(400).send({ error: err.message });
        }

        throw err; // delegado al errorHandler global
      }
    }
  );
}
