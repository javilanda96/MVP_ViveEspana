import { defineConfig } from "vite";

export default defineConfig({
  // All asset URLs will be prefixed with /dashboard/ in the built output,
  // which aligns with the @fastify/static prefix in src/index.ts.
  base: "/dashboard/",
  build: {
    outDir:    "dist",
    emptyOutDir: true,
  },
  server: {
    // In dev mode the Vite server has no knowledge of the Fastify admin routes.
    // This proxy forwards /admin/* and /webhooks/* to the running backend so
    // fetch("/admin/stats", ...) works during development without a 404.
    proxy: {
      "/admin":    "http://localhost:3000",
      "/webhooks": "http://localhost:3000",
    },
  },
});
