import { defineConfig } from "vite";

export default defineConfig({
  // All asset URLs will be prefixed with /dashboard/ in the built output,
  // which aligns with the @fastify/static prefix in src/index.ts.
  base: "/dashboard/",
  build: {
    outDir:    "dist",
    emptyOutDir: true,
  },
});
