import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/standalone.ts" },
  clean: true,
  format: ["cjs"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  // Bundle the application graph, but leave Claude Agent SDK as an ESM package resource.
  noExternal: [/^(?!@anthropic-ai\/claude-agent-sdk$).*/],
  external: ["@anthropic-ai/claude-agent-sdk"],
  outExtension: () => ({ js: ".cjs" }),
});
