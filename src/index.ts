import "dotenv/config";
import { config } from "./config.js"; // must be first after dotenv — runs validateEnv()
import { buildApp } from "./app.js";

const PORT     = config.port;
const NODE_ENV = config.nodeEnv;

async function start(): Promise<void> {
  const app = buildApp({
    logger: {
      level: NODE_ENV === "production" ? "info" : "debug",
      transport:
        NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: { colorize: true, ignore: "pid,hostname" },
            }
          : undefined,
    },
  });

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`Server running on port ${PORT}`);
    app.log.info(`Environment: ${NODE_ENV}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
