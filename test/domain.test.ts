import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSkillsRunnable,
  assertTaskTransition,
  compileAgentInstructions,
  DomainError,
  type Agent,
  type Skill,
  type Task,
} from "@ai-pixel-office/domain";

const timestamp = "2026-09-03T00:00:00.000Z";
const skill: Skill = {
  id: "skill-1",
  name: "UI Review",
  category: "Design",
  description: "Review UI",
  instructions: "Inspect spacing and typography.",
  tools: [{ name: "workspace-reader" }],
  requiredPermissions: ["fileRead"],
  createdAt: timestamp,
  updatedAt: timestamp,
};
const agent: Agent = {
  id: "agent-1",
  workspaceId: "workspace-1",
  name: "UI Reviewer",
  role: "Validate UI quality",
  model: "codex",
  mode: "worker",
  skillIds: [skill.id],
  permissions: { fileRead: true },
  createdAt: timestamp,
  updatedAt: timestamp,
};
const task: Task = {
  id: "task-1",
  workspaceId: "workspace-1",
  title: "Review checkout spacing",
  description: "Check the mobile layout and report exact spacing issues.",
  status: "todo",
  assigneeAgentId: agent.id,
  origin: "office",
  createdAt: timestamp,
  updatedAt: timestamp,
};

test("compiles role, skills, tools, and task into runtime instructions", () => {
  const prompt = compileAgentInstructions(agent, [skill], task);
  assert.match(prompt, /ROLE\nValidate UI quality/);
  assert.match(prompt, /SKILL: UI REVIEW/);
  assert.match(prompt, /workspace-reader/);
  assert.match(prompt, /Review checkout spacing/);
  assert.match(prompt, /Check the mobile layout and report exact spacing issues/);
});

test("rejects a skill when its permission is not granted", () => {
  assert.throws(
    () => assertSkillsRunnable({ ...agent, permissions: {} }, [skill]),
    (error) => error instanceof DomainError && error.code === "MISSING_PERMISSIONS",
  );
});

test("enforces task state transitions", () => {
  assert.doesNotThrow(() => assertTaskTransition("todo", "working"));
  assert.throws(
    () => assertTaskTransition("todo", "done"),
    (error) => error instanceof DomainError && error.status === 409,
  );
});
