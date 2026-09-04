import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../apps/server/src/database.ts";
import { Repository } from "../apps/server/src/repository.ts";

test("persists the MVP domain and normalized activity", () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = repository.createWorkspace({ name: "Studio" });
    const project = repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "App",
      path: process.cwd(),
    });
    const skill = repository.createSkill({
      workspaceId: workspace.id,
      name: "UI Review",
      category: "Design",
      description: "Review a UI",
      instructions: "Inspect spacing.",
      tools: [{ name: "workspace-reader" }],
      requiredPermissions: ["fileRead"],
    });
    const agent = repository.createAgent({
      workspaceId: workspace.id,
      name: "UI Reviewer",
      role: "Review interfaces",
      model: "codex",
      skillIds: [skill.id],
      permissions: { fileRead: true },
    });
    const task = repository.createTask({
      workspaceId: workspace.id,
      title: "Review checkout",
      assigneeAgentId: agent.id,
      priority: "high",
    });

    assert.equal(repository.getAgent(agent.id)?.skillIds[0], skill.id);
    assert.equal(repository.listProjectDirectories(workspace.id)[0]?.id, project.id);
    assert.equal(repository.getTask(task.id)?.status, "todo");
    assert.deepEqual(
      repository.listActivities(workspace.id).map((activity) => activity.type),
      ["task_created", "agent_created"],
    );
  } finally {
    repository.close();
  }
});

test("persists run lifecycle, result review, and usage summaries", () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = repository.createWorkspace({ name: "Studio" });
    const agent = repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Implement tasks",
      model: "codex",
      skillIds: [],
      permissions: {},
    });
    const task = repository.createTask({
      workspaceId: workspace.id,
      title: "Do work",
      assigneeAgentId: agent.id,
    });
    repository.transitionTask(task.id, "working");
    const run = repository.createRun({
      id: "run-1",
      taskId: task.id,
      agentId: agent.id,
      runtime: "codex",
      request: "Add the requested feature",
      workingDirectory: process.cwd(),
      cleanupPolicy: "preserve",
    });
    repository.updateRun(run.id, {
      status: "completed",
      usage: { inputTokens: 10, outputTokens: 3 },
      runtimeThreadId: "thread-1",
      result: { summary: "Done" },
    });
    repository.transitionTask(task.id, "needs_review", { summary: "Done" });
    repository.createReview({ taskId: task.id, runId: run.id, action: "approved" });
    repository.transitionTask(task.id, "done");

    assert.equal(repository.getRun(run.id)?.usage?.inputTokens, 10);
    assert.equal(repository.getRun(run.id)?.request, "Add the requested feature");
    assert.equal(repository.getRun(run.id)?.result?.summary, "Done");
    assert.equal(repository.getRun(run.id)?.workingDirectory, process.cwd());
    assert.equal(repository.getTask(task.id)?.result?.summary, "Done");
    assert.equal(repository.listReviews(task.id)[0]?.action, "approved");
  } finally {
    repository.close();
  }
});

test("recovers waiting runs after a server restart", () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = repository.createWorkspace({ name: "Studio" });
    const agent = repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Implement tasks",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = repository.createTask({
      workspaceId: workspace.id,
      title: "Do work",
      assigneeAgentId: agent.id,
    });
    repository.transitionTask(task.id, "working");
    const run = repository.createRun({
      id: "waiting-run",
      taskId: task.id,
      agentId: agent.id,
      runtime: "codex",
      cleanupPolicy: "preserve",
    });
    repository.updateRun(run.id, { status: "waiting" });

    assert.equal(repository.recoverInterruptedRuns(), 1);
    assert.equal(repository.getRun(run.id)?.status, "failed");
    assert.equal(repository.getTask(task.id)?.status, "failed");
    assert.match(repository.getRun(run.id)?.error ?? "", /Retry the task/);
  } finally {
    repository.close();
  }
});

test("captures Inbox inputs and converts them into linked tasks", () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = repository.createWorkspace({ name: "Studio" });
    const captured = repository.createInput({
      workspaceId: workspace.id,
      type: "idea",
      content: "검색 결과를 프로젝트별로 묶어 보여주기",
    });

    assert.equal(captured.status, "inbox");
    assert.equal(repository.listInputs(workspace.id, "inbox")[0]?.id, captured.id);

    const converted = repository.convertInput(captured.id, { priority: "high" });
    assert.equal(converted.input.status, "converted");
    assert.equal(converted.task.sourceInputId, captured.id);
    assert.equal(converted.task.priority, "high");
    assert.equal(converted.task.description, captured.content);
    assert.equal(repository.listInputs(workspace.id, "inbox").length, 0);
    assert.deepEqual(
      repository.listActivities(workspace.id).map((activity) => activity.type),
      ["input_converted", "task_created", "input_created"],
    );
  } finally {
    repository.close();
  }
});
