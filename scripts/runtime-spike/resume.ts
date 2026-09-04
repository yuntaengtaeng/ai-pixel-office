import { runCodexSpike } from "./codex.ts";

const codeword = `pixel-${Date.now()}`;
const first = await runCodexSpike({
  prompt: `Remember this codeword for the next turn: ${codeword}. Reply only with remembered.`,
  approvalPolicy: "never",
  sandbox: "read-only",
  onEvent: (event) => console.log(JSON.stringify({ stage: "initial", ...event })),
});

const resumed = await runCodexSpike({
  prompt: "Reply with only the codeword I asked you to remember in the previous turn.",
  resumeThreadId: first.threadId,
  approvalPolicy: "never",
  sandbox: "read-only",
  onEvent: (event) => console.log(JSON.stringify({ stage: "resumed", ...event })),
});

const completed = resumed.events.findLast((event) => event.type === "completed");
const summary = completed?.type === "completed" ? completed.result.summary : "";
const sameThread = resumed.threadId === first.threadId;
const contextPreserved = summary.includes(codeword);

console.log(
  JSON.stringify(
    {
      sameThread,
      contextPreserved,
      threadId: resumed.threadId,
      expectedCodeword: codeword,
      result: summary,
    },
    null,
    2,
  ),
);

if (!sameThread || !contextPreserved) process.exitCode = 2;
