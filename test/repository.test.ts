import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../apps/server/src/database.ts";
import { Repository } from "../apps/server/src/repository/index.ts";

test("persists the MVP domain and normalized activity", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const project = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "App",
      path: process.cwd(),
    });
    const skill = await repository.createSkill({
      workspaceId: workspace.id,
      name: "UI Review",
      category: "Design",
      description: "Review a UI",
      instructions: "Inspect spacing.",
      tools: [{ name: "workspace-reader" }],
      requiredPermissions: ["fileRead"],
    });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "UI Reviewer",
      role: "Review interfaces",
      model: "codex",
      skillIds: [skill.id],
      permissions: { fileRead: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Review checkout",
      assigneeAgentId: agent.id,
      priority: "high",
    });

    assert.equal((await repository.getAgent(agent.id))?.skillIds[0], skill.id);
    assert.equal((await repository.listProjectDirectories(workspace.id))[0]?.id, project.id);
    assert.equal((await repository.getTask(task.id))?.status, "todo");
    assert.deepEqual(
      (await repository.listActivities(workspace.id)).map((activity) => activity.type),
      ["task_created", "agent_created"],
    );
  } finally {
    repository.close();
  }
});

test("persists run lifecycle, result review, and usage summaries", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Implement tasks",
      model: "codex",
      skillIds: [],
      permissions: {},
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Do work",
      assigneeAgentId: agent.id,
    });
    await repository.transitionTask(task.id, "working");
    const run = await repository.createRun({
      id: "run-1",
      taskId: task.id,
      agentId: agent.id,
      runtime: "codex",
      request: "Add the requested feature",
      scopeType: "general",
      workingDirectory: process.cwd(),
      cleanupPolicy: "preserve",
    });
    await repository.updateRun(run.id, {
      status: "completed",
      usage: { inputTokens: 10, outputTokens: 3 },
      runtimeThreadId: "thread-1",
      result: { summary: "Done" },
    });
    await repository.transitionTask(task.id, "needs_review", { summary: "Done" });
    await repository.createReview({ taskId: task.id, runId: run.id, action: "approved" });
    await repository.transitionTask(task.id, "done");

    assert.equal((await repository.getRun(run.id))?.usage?.inputTokens, 10);
    assert.equal((await repository.getRun(run.id))?.request, "Add the requested feature");
    assert.equal((await repository.getRun(run.id))?.result?.summary, "Done");
    assert.equal((await repository.getRun(run.id))?.scopeType, "general");
    assert.equal((await repository.getRun(run.id))?.workingDirectory, process.cwd());
    assert.equal((await repository.getTask(task.id))?.result?.summary, "Done");
    assert.equal((await repository.listReviews(task.id))[0]?.action, "approved");
  } finally {
    repository.close();
  }
});

test("recovers waiting runs after a server restart", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Implement tasks",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Do work",
      assigneeAgentId: agent.id,
    });
    await repository.transitionTask(task.id, "working");
    const run = await repository.createRun({
      id: "waiting-run",
      taskId: task.id,
      agentId: agent.id,
      runtime: "codex",
      scopeType: "general",
      cleanupPolicy: "preserve",
    });
    await repository.updateRun(run.id, { status: "waiting" });

    assert.equal(await repository.recoverInterruptedRuns(), 1);
    assert.equal((await repository.getRun(run.id))?.status, "failed");
    assert.equal((await repository.getTask(task.id))?.status, "failed");
    assert.match((await repository.getRun(run.id))?.error ?? "", /Retry the task/);
  } finally {
    repository.close();
  }
});

test("captures Inbox inputs and converts them into linked tasks", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const captured = await repository.createInput({
      workspaceId: workspace.id,
      type: "idea",
      content: "검색 결과를 프로젝트별로 묶어 보여주기",
    });

    assert.equal(captured.status, "inbox");
    assert.equal((await repository.listInputs(workspace.id, "inbox"))[0]?.id, captured.id);

    const converted = await repository.convertInput(captured.id, { priority: "high" });
    assert.equal(converted.input.status, "converted");
    assert.equal(converted.task.sourceInputId, captured.id);
    assert.equal(converted.task.priority, "high");
    assert.equal(converted.task.description, captured.content);
    assert.equal((await repository.listInputs(workspace.id, "inbox")).length, 0);
    assert.deepEqual(
      (await repository.listActivities(workspace.id)).map((activity) => activity.type),
      ["input_converted", "task_created", "input_created"],
    );
  } finally {
    repository.close();
  }
});
