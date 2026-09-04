import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BoundedJsonlWriter } from "../scripts/runtime-spike/runtime-log.ts";

test("bounds raw runtime log growth", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-pixel-office-log-"));
  const writer = new BoundedJsonlWriter(directory, "run-1", 80);
  writer.write({ message: "small" });
  writer.write({ message: "x".repeat(200) });
  writer.write({ message: "ignored" });
  await writer.close();

  const content = readFileSync(writer.path, "utf8");
  assert.match(content, /"small"/);
  assert.match(content, /"log_truncated"/);
  assert.doesNotMatch(content, /"ignored"/);
});
