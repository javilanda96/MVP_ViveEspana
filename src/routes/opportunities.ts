import type { FastifyInstance } from "fastify";
import {
  processOpportunity,
  ValidationError,
  DuplicateEventError,
  type OpportunityPayload,
} from "../services/opportunity.service.js";
import { ghlVerifyHook } from "../hooks/ghl-verify.hook.js";

// ─── JSON Schema ─────────────────────────────────────────────────────────────
//
// Validated by Fastify/ajv before the preHandler runs.
//
// Minimum required fields:
//   - one of id / external_id        (opportunity identifier)
//   - one of contact_id/contactId    (contact linkage)
//   - name or title                  (display name)
//   - pipeline_id or pipelineId
//   - stage_id or stageId
//   - status
//
// additionalProperties: true — GHL sends many extra fields we intentionally
// ignore at the schema level and pass through to metadata.
//
// The fine-grained validation (required combos) is handled in the service
// layer, where we can return descriptive error messages. The schema layer
// only rejects payloads that are structurally wrong (wrong types, etc.).
const opportunityBodySchema = {
  type: "object",
  additionalProperties: true,
  // At least one identifier must be present
  anyOf: [
    { required: ["id"] },
    { required: ["external_id"] },
  ],
  properties: {
    // Event envelope
    event_id:       { type: "string" },

    // Opportunity identifiers
    id:             { type: "string" },
    external_id:    { type: "string" },

    // Contact linkage
    contact_id:     { type: "string" },
    contactId:      { type: "string" },
    contact_email:  { type: "string" },

    // Core fields
    name:           { type: "string" },
    title:          { type: "string" },
    status:         { type: "string" },

    // Pipeline
    pipeline_id:    { type: "string" },
    pipelineId:     { type: "string" },
    pipeline_name:  { type: "string" },
    pipelineName:   { type: "string" },

    // Stage
    stage_id:       { type: "string" },
    stageId:        { type: "string" },
    stage_name:     { type: "string" },
    stageName:      { type: "string" },

    // Value
    monetary_value: { type: "number" },
    monetaryValue:  { type: "number" },
    currency:       { type: "string" },

    // Assignment
    assigned_to:    { type: "string" },
    assignedTo:     { type: "string" },

    // Timestamps
    last_stage_change_at: { type: "string" },
    lastStageChangeAt:    { type: "string" },

    // GHL real webhook fields — normalised to internal names in the service
    opportunity_name: { type: "string" }, // GHL title field (not "name")
    email:            { type: "string" }, // GHL contact email (not "contact_email")
    pipleline_stage:  { type: "string" }, // GHL typo (sic) — maps to stage_name
    phone:            { type: "string" },

    // Passthrough
    metadata:       { type: "object" },
  },
} as const;

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function opportunityRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: OpportunityPayload }>(
    "/webhooks/opportunities",
    {
      preHandler: ghlVerifyHook,
      schema: { body: opportunityBodySchema },
      config: { rateLimit: { max: 300, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const body = request.body;

      // Reject structurally empty payloads (schema passes {} through)
      if (!body || Object.keys(body).length === 0) {
        return reply.status(400).send({ error: "Empty payload" });
      }

      fastify.log.info({ payload: body }, "Incoming opportunity webhook");

      try {
        const opportunity = await processOpportunity(
          body,
          body as Record<string, unknown>
        );

        fastify.log.info(
          {
            opportunityId: opportunity.id,
            externalId:    opportunity.external_id,
            stage:         opportunity.stage_id,
            status:        opportunity.status,
          },
          "Opportunity upserted"
        );

        return reply.status(200).send({ status: "ok" });

      } catch (err) {
        if (err instanceof ValidationError) {
          return reply.status(400).send({ error: err.message });
        }
        if (err instanceof DuplicateEventError) {
          return reply.status(200).send({
            status: "ok",
            message: "duplicate event ignored",
          });
        }
        throw err; // delegate to global error handler
      }
    }
  );
}
