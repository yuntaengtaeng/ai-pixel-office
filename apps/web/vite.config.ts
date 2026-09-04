import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    port: 47371,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:47372",
      "/health": "http://127.0.0.1:47372",
    },
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
});
