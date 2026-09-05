import assert from "node:assert/strict";
import test from "node:test";
import {
  createClaudeNormalizationState,
  normalizeClaudeMessage,
} from "../apps/server/src/runtime/claude.ts";
import { quoteWindowsCmdArgument } from "../scripts/runtime-spike/process.ts";

test("keeps Claude CLI option names unquoted on Windows", () => {
  assert.equal(quoteWindowsCmdArgument("--output-format"), "--output-format");
  assert.equal(quoteWindowsCmdArgument("stream-json"), "stream-json");
  assert.equal(quoteWindowsCmdArgument("model with spaces"), '"model with spaces"');
  assert.throws(() => quoteWindowsCmdArgument("unsafe&value"), /Unsafe Claude CLI argument/);
});

test("normalizes Claude stream-json lifecycle, tools, usage, and result", () => {
  const state = createClaudeNormalizationState();

  assert.deepEqual(
    normalizeClaudeMessage({ type: "system", subtype: "init", session_id: "session-1" }, state),
    [{ type: "started", threadId: "session-1" }],
  );

  const assistant = normalizeClaudeMessage(
    {
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "검토 중입니다." },
          { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "src/App.tsx" } },
        ],
        usage: { input_tokens: 12, output_tokens: 4, cache_read_input_tokens: 3 },
      },
    },
    state,
  );
  assert.deepEqual(assistant, [
    { type: "message", content: "검토 중입니다." },
    { type: "tool_started", tool: "Read", detail: "src/App.tsx" },
    { type: "usage_updated", usage: { inputTokens: 12, outputTokens: 4, cachedInputTokens: 3 } },
  ]);

  assert.deepEqual(
    normalizeClaudeMessage(
      {
        type: "user",
        message: { content: [{ type: "tool_result", tool_use_id: "tool-1" }] },
      },
      state,
    ),
    [{ type: "tool_completed", tool: "Read", status: "completed" }],
  );

  const result = normalizeClaudeMessage(
    {
      type: "result",
      subtype: "success",
      is_error: false,
      session_id: "session-1",
      result: "### 검토 결과\n문제가 없습니다.",
      usage: { input_tokens: 20, output_tokens: 8 },
    },
    state,
  );
  assert.equal(result.at(-1)?.type, "completed");
  assert.equal(state.sessionId, "session-1");
});

test("normalizes Claude result errors with a visible cause", () => {
  const events = normalizeClaudeMessage(
    {
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      errors: ["authentication_failed"],
    },
    createClaudeNormalizationState(),
  );
  assert.deepEqual(events, [{ type: "failed", error: "authentication_failed" }]);
});
