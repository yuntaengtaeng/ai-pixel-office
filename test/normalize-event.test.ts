import assert from "node:assert/strict";
import test from "node:test";
import {
  createNormalizationState,
  normalizeAppServerMessage,
} from "../scripts/runtime-spike/normalize-event.ts";

test("normalizes a command approval round trip", () => {
  const state = createNormalizationState();
  assert.deepEqual(
    normalizeAppServerMessage(
      {
        id: 9,
        method: "item/commandExecution/requestApproval",
        params: { command: "node -v", threadId: "thread-1", turnId: "turn-1" },
      },
      state,
    ),
    [
      {
        type: "permission_requested",
        permission: "terminal",
        requestId: 9,
        details: { command: "node -v", threadId: "thread-1", turnId: "turn-1" },
      },
    ],
  );
});

test("keeps raw item details behind normalized tool events", () => {
  const state = createNormalizationState();
  assert.deepEqual(
    normalizeAppServerMessage(
      {
        method: "item/started",
        params: { item: { type: "commandExecution", command: "npm test", status: "inProgress" } },
      },
      state,
    ),
    [{ type: "tool_started", tool: "terminal", detail: "npm test" }],
  );
});

test("maps completion and cancellation to product-safe events", () => {
  const state = createNormalizationState();
  normalizeAppServerMessage(
    {
      method: "item/completed",
      params: { item: { type: "agentMessage", text: "Review complete" } },
    },
    state,
  );
  assert.deepEqual(
    normalizeAppServerMessage(
      { method: "turn/completed", params: { turn: { id: "turn-1", status: "completed" } } },
      state,
    ),
    [{ type: "completed", result: { summary: "Review complete" } }],
  );
  assert.deepEqual(
    normalizeAppServerMessage(
      { method: "turn/completed", params: { turn: { id: "turn-2", status: "interrupted" } } },
      state,
    ),
    [{ type: "cancelled", cleanupPolicy: "preserve" }],
  );
});
