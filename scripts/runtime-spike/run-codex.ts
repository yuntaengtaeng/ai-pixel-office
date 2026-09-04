import { runCodexSpikeCli } from "./codex.ts";

void runCodexSpikeCli().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
