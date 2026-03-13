import "dotenv/config";
import Fastify from "fastify";
import { checkDatabaseConnection } from "./lib/supabase.js";
import { contactRoutes } from "./routes/contacts.js";
import { paymentRoutes } from "./routes/payments.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const NODE_ENV = process.env.NODE_ENV || "development";

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