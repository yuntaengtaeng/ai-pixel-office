import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityLog, Task, TaskStatus } from "@ai-pixel-office/domain";
import { buildDeskItems, formatWaited } from "../apps/web/src/features/desk/utils/deskItems.ts";

function task(id: string, status: TaskStatus, updatedAt: string): Task {
  return {
    id,
    workspaceId: "w",
    title: id,
    status,
    origin: "office",
    createdAt: updatedAt,
    updatedAt,
  };
}

function activity(type: ActivityLog["type"], taskId: string, createdAt: string): ActivityLog {
  return { id: `${type}-${createdAt}`, workspaceId: "w", type, taskId, message: type, createdAt };
}

test("puts blocking documents first and ignores work that needs no decision", () => {
  const items = buildDeskItems(
    [
      task("draft", "needs_review", "2026-10-04T09:00:00Z"),
      task("working", "working", "2026-10-04T09:00:00Z"),
      task("question", "needs_input", "2026-10-04T10:00:00Z"),
      task("failure", "failed", "2026-10-04T08:00:00Z"),
      task("done", "done", "2026-10-04T08:00:00Z"),
    ],
    [],
  );

  assert.deepEqual(
    items.map((item) => `${item.kind}:${item.task.id}`),
    ["question:question", "failure:failure", "draft:draft"],
  );
});

test("files a waiting task as a permission request only while the approval is unanswered", () => {
  const tasks = [task("t1", "needs_input", "2026-10-04T10:00:00Z")];

  const pending = buildDeskItems(tasks, [
    activity("approval_requested", "t1", "2026-10-04T10:00:00Z"),
  ]);
  const answered = buildDeskItems(tasks, [
    activity("approval_requested", "t1", "2026-10-04T10:00:00Z"),
    activity("approval_resolved", "t1", "2026-10-04T10:01:00Z"),
  ]);

  assert.equal(pending[0]?.kind, "permission");
  assert.equal(answered[0]?.kind, "question");
});

test("lists documents of the same kind by how long they have waited", () => {
  const items = buildDeskItems(
    [
      task("newer", "needs_review", "2026-10-04T11:00:00Z"),
      task("older", "needs_review", "2026-10-04T09:00:00Z"),
    ],
    [],
  );

  assert.deepEqual(
    items.map((item) => item.task.id),
    ["older", "newer"],
  );
});

test("formats how long a document has waited", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  assert.equal(formatWaited("2026-10-04T11:59:40Z", now), "방금");
  assert.equal(formatWaited("2026-10-04T11:48:00Z", now), "12분");
  assert.equal(formatWaited("2026-10-04T09:00:00Z", now), "3시간");
  assert.equal(formatWaited("2026-10-02T12:00:00Z", now), "2일");
});
