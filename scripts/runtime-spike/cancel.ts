import { runCodexSpike } from "./codex.ts";

const result = await runCodexSpike({
  prompt:
    "Use the terminal to run `node -e \"setTimeout(() => console.log('finished'), 30000)\"` and wait for it. " +
    "Do not use a different command.",
  approvalPolicy: "untrusted",
  approvalDecision: "accept",
  sandbox: "workspace-write",
  cancelAfterMs: 3_000,
  timeoutMs: 30_000,
  onEvent: (event) => console.log(JSON.stringify(event)),
});

const cancelled = result.events.some((event) => event.type === "cancelled");
console.log(
  JSON.stringify(
    {
      cancelled,
      cleanupPolicy: "preserve",
      partialArtifactsMayRemain: true,
      threadId: result.threadId,
      eventLogRef: result.eventLogRef,
    },
    null,
    2,
  ),
);
if (!cancelled) process.exitCode = 2;
