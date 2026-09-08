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
  banner: {
    js: "const __pixelOfficeImportMetaUrl = require('node:url').pathToFileURL(__filename).href;",
  },
  esbuildOptions(options) {
    // ESM-only dependencies such as Claude Agent SDK call createRequire(import.meta.url).
    // The packaged server is one CJS bundle, so provide the equivalent URL explicitly.
    options.define = {
      ...options.define,
      "import.meta.url": "__pixelOfficeImportMetaUrl",
    };
  },
});
