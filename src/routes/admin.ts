/**
 * Admin routes — read-only internal operator dashboard.
 *
 * Security model:
 *   - Operator POSTs ADMIN_API_KEY once to /admin/login.
 *   - Server validates it and issues a random HttpOnly session token cookie.
 *   - All subsequent /admin/* requests are authenticated via that cookie.
 *   - ADMIN_API_KEY never touches the frontend bundle.
 *
 * Session store: in-memory Map.  Sessions expire after 24 h.
 * Restarting the server invalidates all sessions (acceptable for an
 * internal single-operator tool).
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";
import * as repo from "../repositories/admin.repository.js";

// ─── Session store ────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const SESSION_COOKIE = "admin_session";
const sessions       = new Map<string, number>(); // token → expiry timestamp

function createSession(): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token: string): boolean {
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) { sessions.delete(token); return false; }
  return true;
}

function getSessionToken(request: FastifyRequest): string | null {
  const cookieHeader = request.headers.cookie ?? "";
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name  = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === SESSION_COOKIE) return value || null;
  }
  return null;
}

// Constant-time key comparison — both inputs hashed to fixed-length buffers
// to avoid length-based timing leaks before timingSafeEqual.
function verifyKey(provided: string, expected: string): boolean {
  const a = Buffer.from(provided.padEnd(64).slice(0, 64));
  const b = Buffer.from(expected.padEnd(64).slice(0, 64));
  return timingSafeEqual(a, b) && provided === expected;
}

// ─── Auth preHandler ──────────────────────────────────────────────────────────

async function adminAuthHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = getSessionToken(request);
  if (!token || !isValidSession(token)) {
    await reply.status(401).send({ error: "Unauthorized" });
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /admin/login ──────────────────────────────────────────────────────
  // Validates ADMIN_API_KEY and sets an HttpOnly session cookie.
  // The raw key is received in the request body (over HTTPS) and never stored
  // in the browser or shipped in the frontend JS bundle.
  fastify.post<{ Body: { key?: string } }>(
    "/admin/login",
    async (request, reply) => {
      const { key } = request.body ?? {};

      if (!config.admin.apiKey) {
        return reply.status(503).send({
          error: "Dashboard not configured. Set ADMIN_API_KEY in environment.",
        });
      }

      if (!key || !verifyKey(key, config.admin.apiKey)) {
        return reply.status(401).send({ error: "Invalid key" });
      }

      const token = createSession();
      reply.header(
        "Set-Cookie",
        `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
      );
      return { ok: true };
    }
  );

  // ── POST /admin/logout ─────────────────────────────────────────────────────
  fastify.post("/admin/logout", async (request, reply) => {
    const token = getSessionToken(request);
    if (token) sessions.delete(token);
    reply.header(
      "Set-Cookie",
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
    );
    return { ok: true };
  });

  // ── Protected routes (all require valid session cookie) ───────────────────

  // GET /admin/stats
  fastify.get("/admin/stats", { preHandler: adminAuthHook }, async () => {
    return repo.getStats();
  });

  // GET /admin/integrations
  fastify.get("/admin/integrations", { preHandler: adminAuthHook }, async () => {
    const secretPresence = {
      ghl:    !!config.webhooks.ghlSecret,
      stripe: !!config.webhooks.stripeSecret,
    };
    return repo.getIntegrationActivity(secretPresence);
  });

  // GET /admin/events
  fastify.get<{
    Querystring: {
      source?: string; status?: string; event_type?: string;
      from?: string; to?: string; external_event_id?: string;
      limit?: string; offset?: string;
    };
  }>(
    "/admin/events",
    { preHandler: adminAuthHook },
    async (request) => {
      const q = request.query;
      return repo.getEvents({
        source:            q.source,
        status:            q.status,
        event_type:        q.event_type,
        from:              q.from,
        to:                q.to,
        external_event_id: q.external_event_id,
        limit:             q.limit  ? parseInt(q.limit,  10) : undefined,
        offset:            q.offset ? parseInt(q.offset, 10) : undefined,
      });
    }
  );

  // GET /admin/events/:id
  fastify.get<{ Params: { id: string } }>(
    "/admin/events/:id",
    { preHandler: adminAuthHook },
    async (request, reply) => {
      const event = await repo.getEventById(request.params.id);
      if (!event) return reply.status(404).send({ error: "Event not found" });
      return event;
    }
  );

  // GET /admin/errors
  fastify.get<{
    Querystring: {
      event_type?: string; from?: string; to?: string;
      limit?: string; offset?: string;
    };
  }>(
    "/admin/errors",
    { preHandler: adminAuthHook },
    async (request) => {
      const q = request.query;
      return repo.getErrors({
        event_type: q.event_type,
        from:       q.from,
        to:         q.to,
        limit:      q.limit  ? parseInt(q.limit,  10) : undefined,
        offset:     q.offset ? parseInt(q.offset, 10) : undefined,
      });
    }
  );

  // GET /admin/pipeline
  fastify.get<{
    Querystring: {
      status?: string; pipeline_name?: string;
      limit?: string; offset?: string;
    };
  }>(
    "/admin/pipeline",
    { preHandler: adminAuthHook },
    async (request) => {
      const q = request.query;
      return repo.getPipeline({
        status:        q.status,
        pipeline_name: q.pipeline_name,
        limit:         q.limit  ? parseInt(q.limit,  10) : undefined,
        offset:        q.offset ? parseInt(q.offset, 10) : undefined,
      });
    }
  );
}
