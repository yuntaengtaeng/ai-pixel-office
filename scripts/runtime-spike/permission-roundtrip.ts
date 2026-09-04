import { runCodexSpike } from "./codex.ts";
import type { ApprovalDecision } from "./types.ts";

const requestedDecision = process.argv[2] ?? "accept";
const allowed = new Set<ApprovalDecision>(["accept", "acceptForSession", "decline", "cancel"]);
if (!allowed.has(requestedDecision as ApprovalDecision)) {
  throw new Error("Decision must be accept, acceptForSession, decline, or cancel");
}
const decision = requestedDecision as ApprovalDecision;

const result = await runCodexSpike({
  prompt:
    "Use the terminal exactly once to run `node -e \"console.log('approval-roundtrip-ok')\"`. " +
    "After the command finishes, report its output. Do not replace the command with reasoning.",
  approvalPolicy: "untrusted",
  approvalDecision: decision,
  sandbox: "workspace-write",
  timeoutMs: 120_000,
  onEvent: (event) => console.log(JSON.stringify(event)),
});

const approval = result.events.find((event) => event.type === "permission_requested");
const completed = result.events.find((event) => event.type === "completed");
console.log(
  JSON.stringify(
    {
      decision,
      approvalObserved: Boolean(approval),
      sameSessionCompleted: Boolean(approval && completed),
      threadId: result.threadId,
      eventLogRef: result.eventLogRef,
    },
    null,
    2,
  ),
);

if (!approval) process.exitCode = 2;
if (decision.startsWith("accept") && !completed) process.exitCode = 3;
