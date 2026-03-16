import "dotenv/config";
import { config } from "./config.js"; // must be first after dotenv — runs validateEnv()
import { fileURLToPath } from "url";
import { dirname, join }  from "path";
import { existsSync }     from "fs";
import Fastify            from "fastify";
import fastifyStatic      from "@fastify/static";
import { checkDatabaseConnection } from "./lib/supabase.js";
import { contactRoutes }     from "./routes/contacts.js";
import { paymentRoutes }     from "./routes/payments.js";
import { opportunityRoutes } from "./routes/opportunities.js";
import { adminRoutes }       from "./routes/admin.js";

// Expose rawBody on every request so webhook signature preHandlers can read
// the exact bytes Stripe signed, before Fastify re-serialises the parsed body.
//
// Two augmentations are needed:
//   1. http.IncomingMessage — this is the type Fastify uses for the `req`
//      parameter inside addContentTypeParser callbacks.
//   2. FastifyRequest — this is the type used in preHandlers and route handlers.
// At runtime both refer to the same decorated object; the dual declaration
// satisfies the TypeScript compiler for both call sites.
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

const PORT     = config.port;
const NODE_ENV = config.nodeEnv;

const fastify = Fastify({
  logger: {
    level: NODE_ENV === "production" ? "info" : "debug",
    transport:
      NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              ignore: "pid,hostname",
            },
          }
        : undefined,
  },
});

// ============================================================================
// RAW BODY CAPTURE
// ============================================================================
//
// Replaces Fastify's default JSON parser so the unparsed Buffer is stored on
// request.rawBody before the body is decoded. Stripe's HMAC verification must
// run against the exact original bytes — any re-serialisation invalidates it.
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

// ============================================================================
// DASHBOARD — static assets
// ============================================================================
//
// Serves the pre-built Vite dashboard from dashboard/dist/.
// Build with: cd dashboard && npm run build
//
// Uses import.meta.url so the path resolves correctly whether the server is
// started via tsx (src/) or compiled node (dist/).
const __filename    = fileURLToPath(import.meta.url);
const __dirname     = dirname(__filename);
const dashboardRoot = join(__dirname, "..", "dashboard", "dist");

if (existsSync(dashboardRoot)) {
  fastify.register(fastifyStatic, {
    root:           dashboardRoot,
    prefix:         "/dashboard/",
    decorateReply:  false,
  });

  // Convenience redirect: /dashboard → /dashboard/
  fastify.get("/dashboard", async (_req, reply) => {
    return reply.redirect(302, "/dashboard/");
  });

  fastify.log.info("Dashboard available at /dashboard/");
} else {
  fastify.log.warn(
    "dashboard/dist not found — dashboard unavailable. " +
    "Run: cd dashboard && npm install && npm run build"
  );
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

fastify.get("/health", async () => {
  const dbOk = await checkDatabaseConnection();

  return {
    status: dbOk ? "ok" : "db_error",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  };
});

// ============================================================================
// ROUTES
// ============================================================================

fastify.register(contactRoutes);
fastify.register(paymentRoutes);
fastify.register(opportunityRoutes);
fastify.register(adminRoutes);

// PENDING:
// POST /webhooks/subscriptions (Stripe)

// ============================================================================
// ERROR HANDLING
// ============================================================================

fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);

  reply.status(500).send({
    error: "Internal Server Error",
    message: NODE_ENV === "development" ? error.message : undefined,
  });
});

// ============================================================================
// STARTUP
// ============================================================================

async function start(): Promise<void> {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });

    fastify.log.info(`Server running on port ${PORT}`);
    fastify.log.info(`Environment: ${NODE_ENV}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
