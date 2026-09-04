import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/main.ts"],
    clean: true,
    format: ["esm"],
    platform: "node",
    target: "node22",
    sourcemap: true,
    external: ["electron"],
  },
  {
    entry: ["src/preload.ts"],
    clean: false,
    format: ["cjs"],
    platform: "node",
    target: "node22",
    sourcemap: true,
    external: ["electron"],
    outExtension: () => ({ js: ".cjs" }),
  },
]);
