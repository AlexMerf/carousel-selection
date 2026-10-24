import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Tests cover the pure data layer only, so this config deliberately skips the
// Vite plugins: Tailwind's native binary refuses to load in the sandbox, and
// nothing here needs JSX, CSS or the react plugin.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
