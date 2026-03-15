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

  // In production, webhook secrets are mandatory.
  // Without them the signature preHandlers run in permissive mode and accept
  // every incoming request regardless of origin — a critical security gap.
  if ((process.env.NODE_ENV || "development") === "production") {
    const requiredInProduction = [
      "STRIPE_WEBHOOK_SECRET",
      "GHL_WEBHOOK_SECRET",
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
} as const;

export default config;
