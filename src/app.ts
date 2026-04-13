import { fileURLToPath } from "url";
import { dirname, join }  from "path";
import { existsSync }     from "fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic      from "@fastify/static";
import helmet             from "@fastify/helmet";
import rateLimit          from "@fastify/rate-limit";
import { checkDatabaseConnection } from "./lib/supabase.js";
import { contactRoutes }     from "./routes/contacts.js";
import { paymentRoutes }     from "./routes/payments.js";
import { opportunityRoutes } from "./routes/opportunities.js";
import { adminRoutes }       from "./routes/admin.js";

declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    rawBody: Buffer | undefined;
  }
}

export interface BuildAppOptions {
  logger?: boolean | object;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const fastify = Fastify({
    bodyLimit: 1 * 1024 * 1024,
    logger: (opts.logger ?? false) as boolean,
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────────
  // Webhook endpoints: 300 req/min por IP — protección contra flood.
  // Admin login: límite propio en-ruta (10 req / 15 min, gestionado manualmente).
  fastify.register(rateLimit, {
    global:     false, // opt-in por ruta
    max:        300,
    timeWindow: "1 minute",
  });

  // ── Security headers ──────────────────────────────────────────────────────────
  fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", "'unsafe-inline'"], // dashboard inline scripts
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", "data:"],
      },
    },
  });

  // ── Raw body capture ──────────────────────────────────────────────────────────
  // Must run before JSON is parsed so Stripe HMAC verification sees original bytes.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    function (req, body, done) {
      try {
        req.rawBody = body as Buffer;
        done(null, JSON.parse(body.toString("utf8")));
      } catch (err) {
        done(err instanceof Error ? err : new Error(String(err)), undefined);
      }
    }
  );

  // ── Dashboard static assets ───────────────────────────────────────────────────
  const __filename    = fileURLToPath(import.meta.url);
  const __dirname     = dirname(__filename);
  const dashboardRoot = join(__dirname, "..", "dashboard", "dist");

  if (existsSync(dashboardRoot)) {
    fastify.register(fastifyStatic, {
      root:          dashboardRoot,
      prefix:        "/dashboard/",
      decorateReply: false,
    });
    fastify.get("/",          async (_req, reply) => reply.redirect(302, "/dashboard/"));
    fastify.get("/dashboard", async (_req, reply) => reply.redirect(302, "/dashboard/"));
    fastify.log.info("Dashboard available at /dashboard/");
  }

  // ── Health check ──────────────────────────────────────────────────────────────
  fastify.get("/health", async () => {
    const dbOk = await checkDatabaseConnection();
    return { status: dbOk ? "ok" : "db_error", timestamp: new Date().toISOString() };
  });

  // ── Routes ────────────────────────────────────────────────────────────────────
  fastify.register(contactRoutes);
  fastify.register(paymentRoutes);
  fastify.register(opportunityRoutes);
  fastify.register(adminRoutes);

  // ── Error handler ─────────────────────────────────────────────────────────────
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    const statusCode = error.statusCode ?? 500;
    if (statusCode < 500) {
      return reply.status(statusCode).send({ error: error.message });
    }
    return reply.status(500).send({ error: "Internal Server Error" });
  });

  return fastify;
}
