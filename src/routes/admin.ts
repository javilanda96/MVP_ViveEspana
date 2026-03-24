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

// ─── Login rate limiter ───────────────────────────────────────────────────────

const LOGIN_WINDOW_MS    = 15 * 60 * 1000; // 15 min
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts      = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now   = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

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

      if (!checkLoginRateLimit(request.ip)) {
        return reply.status(429).send({ error: "Demasiados intentos. Espera 15 minutos." });
      }

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

  // ── /admin/connections ────────────────────────────────────────────────────

  const VALID_SOURCES    = new Set(["ghl", "stripe", "flywire", "holded", "manual"]);
  const VALID_AUTH_TYPES = new Set(["GHL Shared Secret", "HMAC-SHA256", "none"]);

  function validateConnectionFields(
    body: Partial<repo.ConnectionInput>,
    reply: FastifyReply,
    requireAll: boolean
  ): boolean {
    const { source, auth_type, enabled } = body;
    if (requireAll) {
      if (!body.name || !body.source || !body.event_type || !body.endpoint || !body.auth_type) {
        void reply.status(400).send({ error: "Campos requeridos: name, source, event_type, endpoint, auth_type" });
        return false;
      }
    }
    if (source !== undefined && !VALID_SOURCES.has(source)) {
      void reply.status(400).send({ error: `source inválido. Permitidos: ${[...VALID_SOURCES].join(", ")}` });
      return false;
    }
    if (auth_type !== undefined && !VALID_AUTH_TYPES.has(auth_type)) {
      void reply.status(400).send({ error: `auth_type inválido. Permitidos: ${[...VALID_AUTH_TYPES].join(", ")}` });
      return false;
    }
    if (enabled !== undefined && typeof enabled !== "boolean") {
      void reply.status(400).send({ error: "enabled debe ser boolean" });
      return false;
    }
    return true;
  }

  // GET /admin/connections
  fastify.get("/admin/connections", { preHandler: adminAuthHook }, async () => {
    return repo.listConnections();
  });

  // POST /admin/connections
  fastify.post<{ Body: repo.ConnectionInput }>(
    "/admin/connections",
    { preHandler: adminAuthHook },
    async (request, reply) => {
      if (!validateConnectionFields(request.body, reply, true)) return;
      const { name, source, event_type, endpoint, auth_type, description, enabled,
              base_url, account_id, public_key, notes } = request.body;
      return repo.createConnection({
        name, source, event_type, endpoint, auth_type,
        description: description ?? null,
        enabled:     enabled ?? true,
        base_url:    base_url   ?? null,
        account_id:  account_id ?? null,
        public_key:  public_key ?? null,
        notes:       notes      ?? null,
      });
    }
  );

  // PATCH /admin/connections/:id
  fastify.patch<{ Params: { id: string }; Body: Partial<repo.ConnectionInput> }>(
    "/admin/connections/:id",
    { preHandler: adminAuthHook },
    async (request, reply) => {
      if (!validateConnectionFields(request.body, reply, false)) return;
      const row = await repo.updateConnection(request.params.id, request.body);
      if (!row) return reply.status(404).send({ error: "Not found" });
      return row;
    }
  );

  // GET /admin/alerts
  fastify.get<{
    Querystring: {
      status?: string; severity?: string;
      from?: string; to?: string;
      limit?: string; offset?: string;
    };
  }>(
    "/admin/alerts",
    { preHandler: adminAuthHook },
    async (request) => {
      const q = request.query;
      return repo.getAlerts({
        status:   q.status,
        severity: q.severity,
        from:     q.from,
        to:       q.to,
        limit:    q.limit  ? parseInt(q.limit,  10) : undefined,
        offset:   q.offset ? parseInt(q.offset, 10) : undefined,
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

  // ── Sales endpoints ──────────────────────────────────────────────────────────

  // GET /admin/sales/funnel
  // Returns KPIs + stage breakdown.
  // ?pipeline_name= scopes stage rows (KPIs always global when no period given).
  // ?from= ?to= ISO date strings — when present, KPIs and stages are both
  // scoped to opportunities.created_at within the range (computed from raw
  // opportunities, not the aggregation view).
  // Invalid date format → 400.
  fastify.get<{
    Querystring: { pipeline_name?: string; from?: string; to?: string };
  }>(
    "/admin/sales/funnel",
    { preHandler: adminAuthHook },
    async (request, reply) => {
      const q = request.query;
      if (q.from && isNaN(Date.parse(q.from))) {
        return reply.status(400).send({ error: "Invalid 'from' date — use ISO 8601 format (e.g. 2026-01-01)" });
      }
      if (q.to && isNaN(Date.parse(q.to))) {
        return reply.status(400).send({ error: "Invalid 'to' date — use ISO 8601 format (e.g. 2026-01-31)" });
      }
      return repo.getSalesFunnel({
        pipeline_name: q.pipeline_name,
        from:          q.from,
        to:            q.to,
      });
    }
  );

  // GET /admin/sales/deals
  // Returns paginated rows from sales_deals_outcomes.
  // Filters: ?status= ?pipeline_name= ?from= ?to= ?limit= ?offset=
  fastify.get<{
    Querystring: {
      status?: string; pipeline_name?: string;
      from?: string; to?: string;
      limit?: string; offset?: string;
    };
  }>(
    "/admin/sales/deals",
    { preHandler: adminAuthHook },
    async (request) => {
      const q = request.query;
      return repo.getSalesDeals({
        status:        q.status,
        pipeline_name: q.pipeline_name,
        from:          q.from,
        to:            q.to,
        limit:         q.limit  ? parseInt(q.limit,  10) : undefined,
        offset:        q.offset ? parseInt(q.offset, 10) : undefined,
      });
    }
  );
}
