import assert from "node:assert/strict";
import test from "node:test";
import type { Agent, Task } from "@ai-pixel-office/domain/entities";
import { selectModel } from "../apps/server/src/model-routing.ts";

const task = (priority: Task["priority"]): Task => ({
  id: "task-1",
  workspaceId: "workspace-1",
  title: "작업",
  status: "todo",
  priority,
  createdAt: "2026-09-04T00:00:00.000Z",
  updatedAt: "2026-09-04T00:00:00.000Z",
});

const agent = (input: Partial<Agent> = {}): Agent => ({
  id: "agent-1",
  workspaceId: "workspace-1",
  name: "동료",
  role: "개발",
  model: "codex",
  mode: "worker",
  skillIds: [],
  permissions: {},
  createdAt: "2026-09-04T00:00:00.000Z",
  updatedAt: "2026-09-04T00:00:00.000Z",
  ...input,
});

test("keeps CLI settings for the default model policy", () => {
  assert.deepEqual(selectModel(agent(), task("high")), { policy: "default" });
});

test("routes Codex automatically from task priority", () => {
  assert.deepEqual(selectModel(agent({ modelPolicy: "auto" }), task("low")), {
    policy: "auto",
    modelName: "gpt-5.6-luna",
    reasoningEffort: "low",
  });
  assert.deepEqual(selectModel(agent({ modelPolicy: "auto" }), task("medium")), {
    policy: "auto",
    modelName: "gpt-5.6-terra",
    reasoningEffort: "medium",
  });
  assert.deepEqual(selectModel(agent({ modelPolicy: "auto" }), task("high")), {
    policy: "auto",
    modelName: "gpt-5.6-sol",
    reasoningEffort: "high",
  });
});

test("routes Claude automatically and preserves manual choices", () => {
  assert.deepEqual(selectModel(agent({ model: "claude", modelPolicy: "auto" }), task("high")), {
    policy: "auto",
    modelName: "opus",
    reasoningEffort: "high",
  });
  assert.deepEqual(
    selectModel(
      agent({ modelPolicy: "manual", modelName: "custom-model", reasoningEffort: "xhigh" }),
      task("low"),
    ),
    {
      policy: "manual",
      modelName: "custom-model",
      reasoningEffort: "xhigh",
    },
  );
});
