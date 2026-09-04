import assert from "node:assert/strict";
import test from "node:test";
import { createCodexExitError } from "../scripts/runtime-spike/json-rpc.ts";

test("explains how to recover when the Codex home is blocked", () => {
  const error = createCodexExitError(1, null, "Error: Could not find home directory");
  assert.match(error.message, /Windows PowerShell/);
  assert.doesNotMatch(error.message, /code=1/);
});
