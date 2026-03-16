// Validar que todas las variables de entorno requeridas están presentes
function validateEnv(): void {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  // In production, webhook secrets and admin key are mandatory.
  if ((process.env.NODE_ENV || "development") === "production") {
    const requiredInProduction = [
      "STRIPE_WEBHOOK_SECRET",
      "GHL_WEBHOOK_SECRET",
      "ADMIN_API_KEY",
    ];
    const missingInProduction = requiredInProduction.filter(
      (key) => !process.env[key]
    );
    if (missingInProduction.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missingInProduction.join(", ")}. ` +
        `Set them or the webhook endpoints will accept unauthenticated requests.`
      );
    }
  }

  // Development-only warning (non-fatal)
  if ((process.env.NODE_ENV || "development") === "development") {
    if (!process.env.ADMIN_API_KEY) {
      console.warn(
        "[config] ADMIN_API_KEY not set — dashboard login is disabled. " +
        "Add ADMIN_API_KEY=<any-string> to .env to enable the operator dashboard."
      );
    }
  }
}

validateEnv();

export const config = {
  // Server
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isDevelopment: (process.env.NODE_ENV || "development") === "development",
  isProduction: (process.env.NODE_ENV || "development") === "production",

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
  },

  // Webhook secrets — absent (undefined/empty) enables permissive dev mode
  webhooks: {
    timeoutMs:    5000,
    maxRetries:   3,
    stripeSecret: process.env.STRIPE_WEBHOOK_SECRET || undefined,
    ghlSecret:    process.env.GHL_WEBHOOK_SECRET    || undefined,
  },

  // Admin dashboard — absent disables login (non-fatal in dev, required in production)
  admin: {
    apiKey: process.env.ADMIN_API_KEY || undefined,
  },
} as const;

export default config;
