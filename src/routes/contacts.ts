import type { FastifyInstance } from "fastify";
import {
  processContact,
  ValidationError,
  type ContactPayload,
} from "../services/contact.service.js";
import { ghlVerifyHook } from "../hooks/ghl-verify.hook.js";

// ─── JSON Schema ─────────────────────────────────────────────────────────────
//
// Validated by Fastify/ajv before the preHandler runs.
// additionalProperties: true — GHL may send extra fields we intentionally ignore.
// anyOf enforces that at least one contact identifier (email OR phone) is present;
// this mirrors the service-level check so malformed payloads are rejected early.
const contactBodySchema = {
  type: "object",
  additionalProperties: true,
  anyOf: [
    { required: ["email"] },
    { required: ["phone"] },
  ],
  properties: {
    email:       { type: "string" },
    phone:       { type: "string" },
    first_name:  { type: "string" },
    last_name:   { type: "string" },
    name:        { type: "string" },
    firstName:   { type: "string" },
    lastName:    { type: "string" },
    external_id: { type: "string" },
    id:          { type: "string" },
    source:      { type: "string", enum: ["ghl", "stripe", "manual"] },
    metadata:    { type: "object" },
  },
} as const;

export async function contactRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ContactPayload }>(
    "/webhooks/contacts",
    { preHandler: ghlVerifyHook, schema: { body: contactBodySchema } },
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
