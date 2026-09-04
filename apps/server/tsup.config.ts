import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/standalone.ts" },
  clean: true,
  format: ["cjs"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  noExternal: [/.*/],
  outExtension: () => ({ js: ".cjs" }),
});
