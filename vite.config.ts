import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isCiBuild = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/, local dev stays at /.
  base: isCiBuild ? "/carousel-selection/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
});
