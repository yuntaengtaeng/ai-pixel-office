import assert from "node:assert/strict";
import test from "node:test";
import type { Agent } from "@ai-pixel-office/domain";
import { approvalLineCells } from "../apps/web/src/features/tasks/utils/approvalLine.ts";

function agent(id: string, name: string, role: string): Agent {
  return {
    id,
    workspaceId: "w",
    name,
    role,
    model: "claude",
    mode: "worker",
    skillIds: [],
    permissions: {},
    createdAt: "",
    updatedAt: "",
  };
}

const agents = [agent("dev", "단풍", "Developer")];

test("stamps the assignee and puts the final approval on me when the draft is ready", () => {
  const cells = approvalLineCells({ status: "needs_review", assigneeAgentId: "dev" }, agents);

  assert.deepEqual(
    cells.map((cell) => `${cell.heading}:${cell.stampName}:${cell.state}`),
    ["Developer:단풍:stamped", "승인:결재:mine"],
  );
});

test("keeps the final approval waiting while the assignee works", () => {
  const cells = approvalLineCells({ status: "working", assigneeAgentId: "dev" }, agents);

  assert.deepEqual(
    cells.map((cell) => cell.state),
    ["working", "waiting"],
  );
});

test("shows only the final approval when nobody is assigned yet", () => {
  const cells = approvalLineCells({ status: "todo" }, agents);

  assert.deepEqual(
    cells.map((cell) => `${cell.stampName}:${cell.state}`),
    ["결재:waiting"],
  );
});
