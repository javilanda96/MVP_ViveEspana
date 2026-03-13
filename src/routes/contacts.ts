import type { FastifyInstance } from "fastify";
import {
  processContact,
  ValidationError,
  type ContactPayload,
} from "../services/contact.service.js";

export async function contactRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ContactPayload }>(
    "/webhooks/contacts",
    async (request, reply) => {
      const body = request.body;

      // Reject empty payloads
      if (!body || Object.keys(body).length === 0) {
        return reply.status(400).send({ error: "Empty payload" });
      }

      // Log the full incoming payload for inspection and debugging
      fastify.log.info({ payload: body }, "Incoming contact webhook");

      try {
        const contact = await processContact(
          body,
          body as Record<string, unknown>
        );

        fastify.log.info(
          { contactId: contact.id, source: contact.source },
          "Contact upserted"
        );

        return reply.status(200).send({ status: "ok" });
      } catch (err) {
        if (err instanceof ValidationError) {
          return reply.status(400).send({ error: err.message });
        }
        throw err; // delegado al errorHandler global
      }
    }
  );
}
