import type { FastifyInstance } from "fastify";
import {
  processPayment,
  ValidationError,
  DuplicatePaymentError,
  type PaymentPayload,
} from "../services/payment.service.js";

export async function paymentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: PaymentPayload }>(
    "/webhooks/payments",
    async (request, reply) => {
      const body = request.body;

      // Reject empty payloads
      if (!body || Object.keys(body).length === 0) {
        return reply.status(400).send({ error: "Empty payload" });
      }

      // Log the full incoming payload for inspection and debugging
      fastify.log.info({ payload: body }, "Incoming payment webhook");

      try {
        const payment = await processPayment(
          body,
          body as Record<string, unknown>
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
          return reply.status(400).send({ error: err.message });
        }

        throw err; // delegado al errorHandler global
      }
    }
  );
}
