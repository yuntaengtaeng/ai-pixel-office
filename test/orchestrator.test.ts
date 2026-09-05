import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import test from "node:test";
import { EventBus } from "../apps/server/src/events.ts";
import { openDatabase } from "../apps/server/src/database.ts";
import { Orchestrator } from "../apps/server/src/orchestrator.ts";
import { Repository } from "../apps/server/src/repository/index.ts";
import type {
  RuntimeAdapter,
  RuntimeCallbacks,
  RuntimeRunInput,
} from "../apps/server/src/runtime/index.ts";
import type { CodexSpikeResult } from "../scripts/runtime-spike/codex.ts";
import type { ApprovalDecision } from "../scripts/runtime-spike/types.ts";

const generalWorkingDirectory = tmpdir();

class ApprovalRuntime implements RuntimeAdapter {
  private pending: ((decision: ApprovalDecision) => void) | undefined;
  private requestId = "approval-1";

  async run(input: RuntimeRunInput, callbacks: RuntimeCallbacks): Promise<CodexSpikeResult> {
    callbacks.onEvent({ type: "started", threadId: "thread-1", turnId: "turn-1" });
    callbacks.onEvent({
      type: "permission_requested",
      permission: "terminal",
      requestId: this.requestId,
    });
    const decision = await new Promise<ApprovalDecision>((resolveDecision) => {
      this.pending = resolveDecision;
      callbacks.onApprovalPending({
        id: this.requestId,
        method: "item/commandExecution/requestApproval",
        params: {},
      });
    });
    const events: CodexSpikeResult["events"] = [];
    if (decision === "accept") {
      const complete = { type: "completed", result: { summary: "Reviewed" } } as const;
      callbacks.onEvent(complete);
      events.push(complete);
    } else {
      const cancelled = { type: "cancelled", cleanupPolicy: "preserve" } as const;
      callbacks.onEvent(cancelled);
      events.push(cancelled);
    }
    return {
      runId: input.runId,
      threadId: "thread-1",
      turnId: "turn-1",
      eventLogRef: `.runtime-logs/${input.runId}.jsonl`,
      events,
    };
  }

  cancel(): boolean {
    this.pending?.("cancel");
    return Boolean(this.pending);
  }

  resolveApproval(_runId: string, requestId: string, decision: ApprovalDecision): boolean {
    if (!this.pending || requestId !== this.requestId) return false;
    const resolveDecision = this.pending;
    this.pending = undefined;
    resolveDecision(decision);
    return true;
  }
}

async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for state change");
    await new Promise((resolveWait) => setTimeout(resolveWait, 5));
  }
}

test("runs task through approval, review, and approval persistence", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Reviewer",
      role: "Review UI",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Review checkout",
      assigneeAgentId: agent.id,
    });
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus(), {
      generalWorkingDirectory,
    });
    const run = await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getRun(run.id))?.status === "waiting");
    assert.equal((await repository.getTask(task.id))?.status, "needs_input");
    assert.deepEqual(
      (await repository.listRunProgress(run.id)).map((event) => event.type),
      ["started", "permission_requested"],
    );

    await orchestrator.resolveApproval(run.id, "approval-1", "accept");
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
    assert.equal((await repository.getRun(run.id))?.runtimeThreadId, "thread-1");
    assert.equal((await repository.getTask(task.id))?.result?.summary, "Reviewed");

    await orchestrator.approveTask(task.id);
    assert.equal((await repository.getTask(task.id))?.status, "done");
    assert.equal((await repository.listReviews(task.id))[0]?.action, "approved");
  } finally {
    repository.close();
  }
});

test("retries a failed task without creating a replacement task", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Retry Agent",
      role: "Retry work",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Retry this task",
      assigneeAgentId: agent.id,
    });
    await repository.transitionTask(task.id, "working");
    await repository.transitionTask(task.id, "failed");

    const runtime = new ApprovalRuntime();
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory,
    });
    const run = await orchestrator.retryTask(task.id);
    await waitFor(async () => (await repository.getRun(run.id))?.status === "waiting");
    assert.equal((await repository.getTask(task.id))?.status, "needs_input");

    await orchestrator.resolveApproval(run.id, "approval-1", "accept");
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
  } finally {
    repository.close();
  }
});

test("reserves exactly one run when the same task starts concurrently", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  const runtime: RuntimeAdapter = {
    async run(input, callbacks) {
      const completed = { type: "completed", result: { summary: "Done" } } as const;
      callbacks.onEvent({ type: "started", threadId: input.runId });
      callbacks.onEvent(completed);
      return { runId: input.runId, threadId: input.runId, turnId: input.runId, events: [completed] };
    },
    cancel: () => false,
    resolveApproval: () => false,
  };
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Build",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Start once",
      assigneeAgentId: agent.id,
    });
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory,
    });

    const results = await Promise.allSettled([
      orchestrator.startTask(task.id),
      orchestrator.startTask(task.id),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal((await repository.listRuns(task.id)).length, 1);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
  } finally {
    repository.close();
  }
});

test("enforces the workspace run limit during concurrent reservations", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  const runtime = new ApprovalRuntime();
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Build",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const tasks = await Promise.all(
      ["First", "Second"].map((title) =>
        repository.createTask({ workspaceId: workspace.id, title, assigneeAgentId: agent.id }),
      ),
    );
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory,
      concurrentRunLimit: 1,
    });

    const results = await Promise.allSettled(tasks.map((task) => orchestrator.startTask(task.id)));

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal((await repository.listRuns()).length, 1);
    const activeRun = (await repository.listRuns())[0]!;
    await waitFor(async () => (await repository.getRun(activeRun.id))?.status === "waiting");
    await orchestrator.cancelRun(activeRun.id);
    await waitFor(async () => !["queued", "running", "waiting"].includes((await repository.getRun(activeRun.id))?.status ?? ""));
  } finally {
    repository.close();
  }
});

test("rejects a run reservation when the task project changes after scope resolution", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Build",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const firstProject = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "First",
      path: process.cwd(),
    });
    const secondProject = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "Second",
      path: process.cwd(),
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Keep scope stable",
      assigneeAgentId: agent.id,
      projectId: firstProject.id,
    });
    const originalListRuns = repository.listRuns.bind(repository);
    let resumeReservation!: () => void;
    const reservationPaused = new Promise<void>((resolve) => {
      resumeReservation = resolve;
    });
    let scopeResolved!: () => void;
    const scopeResolutionReached = new Promise<void>((resolve) => {
      scopeResolved = resolve;
    });
    repository.listRuns = async (taskId) => {
      const runs = await originalListRuns(taskId);
      scopeResolved();
      await reservationPaused;
      return runs;
    };
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus(), {
      generalWorkingDirectory,
    });

    const start = orchestrator.startTask(task.id);
    await scopeResolutionReached;
    await repository.updateTask(task.id, { projectId: secondProject.id });
    resumeReservation();

    await assert.rejects(start, /실행 예약 중 작업의 프로젝트가 변경되었습니다/);
    assert.equal((await repository.getTask(task.id))?.projectId, secondProject.id);
    assert.equal((await repository.getTask(task.id))?.status, "todo");
    assert.equal((await originalListRuns(task.id)).length, 0);
  } finally {
    repository.close();
  }
});

test("rejects an assignee update that loses a race with run reservation", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  const runtime = new ApprovalRuntime();
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const firstAgent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "First",
      role: "Build",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const secondAgent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Second",
      role: "Review",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Preserve current status",
      assigneeAgentId: firstAgent.id,
    });
    const originalGetAgent = repository.getAgent.bind(repository);
    let resumeUpdate!: () => void;
    const updatePaused = new Promise<void>((resolve) => {
      resumeUpdate = resolve;
    });
    let validationReached!: () => void;
    const validationPaused = new Promise<void>((resolve) => {
      validationReached = resolve;
    });
    let pauseNextAgentLookup = true;
    repository.getAgent = async (id) => {
      const agent = await originalGetAgent(id);
      if (pauseNextAgentLookup) {
        pauseNextAgentLookup = false;
        validationReached();
        await updatePaused;
      }
      return agent;
    };
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory,
    });

    const update = repository.updateTask(task.id, { assigneeAgentId: secondAgent.id });
    await validationPaused;
    const run = await orchestrator.startTask(task.id);
    resumeUpdate();
    await assert.rejects(update, /실행 중인 작업의 담당 Agent는 변경할 수 없습니다/);

    assert.notEqual((await repository.getTask(task.id))?.status, "todo");
    assert.equal((await repository.getTask(task.id))?.assigneeAgentId, firstAgent.id);
    assert.equal((await repository.getRun(run.id))?.agentId, firstAgent.id);
    assert.equal((await repository.listRuns(task.id)).length, 1);
    await waitFor(async () => (await repository.getRun(run.id))?.status === "waiting");
    await orchestrator.cancelRun(run.id);
    await waitFor(
      async () =>
        !["queued", "running", "waiting"].includes(
          (await repository.getRun(run.id))?.status ?? "",
        ),
    );
  } finally {
    repository.close();
  }
});

test("rejects a run reservation when the assignee changes after agent preparation", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agents = await Promise.all(
      ["First", "Second"].map((name) =>
        repository.createAgent({
          workspaceId: workspace.id,
          name,
          role: "Build",
          model: "codex",
          skillIds: [],
          permissions: { fileRead: true, terminal: true },
        }),
      ),
    );
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Keep assignment stable",
      assigneeAgentId: agents[0]!.id,
    });
    const originalListRuns = repository.listRuns.bind(repository);
    let resumeReservation!: () => void;
    const reservationPaused = new Promise<void>((resolve) => {
      resumeReservation = resolve;
    });
    let agentPrepared!: () => void;
    const agentPreparationReached = new Promise<void>((resolve) => {
      agentPrepared = resolve;
    });
    repository.listRuns = async (taskId) => {
      const runs = await originalListRuns(taskId);
      agentPrepared();
      await reservationPaused;
      return runs;
    };
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus(), {
      generalWorkingDirectory,
    });

    const start = orchestrator.startTask(task.id);
    await agentPreparationReached;
    await repository.updateTask(task.id, { assigneeAgentId: agents[1]!.id });
    resumeReservation();

    await assert.rejects(start, /실행 예약 중 작업의 담당 Agent가 변경되었습니다/);
    assert.equal((await repository.getTask(task.id))?.assigneeAgentId, agents[1]!.id);
    assert.equal((await repository.getTask(task.id))?.status, "todo");
    assert.equal((await originalListRuns(task.id)).length, 0);
  } finally {
    repository.close();
  }
});

test("rejects a non-workflow reservation when workflow is configured concurrently", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agents = await Promise.all(
      ["First", "Second"].map((name) =>
        repository.createAgent({
          workspaceId: workspace.id,
          name,
          role: "Build",
          model: "codex",
          skillIds: [],
          permissions: { fileRead: true, terminal: true },
        }),
      ),
    );
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Keep workflow stable",
      assigneeAgentId: agents[0]!.id,
    });
    const originalListRuns = repository.listRuns.bind(repository);
    let resumeReservation!: () => void;
    const reservationPaused = new Promise<void>((resolve) => {
      resumeReservation = resolve;
    });
    let runCheckReached!: () => void;
    const runCheckPaused = new Promise<void>((resolve) => {
      runCheckReached = resolve;
    });
    let pauseNextRunCheck = true;
    repository.listRuns = async (taskId) => {
      const runs = await originalListRuns(taskId);
      if (pauseNextRunCheck) {
        pauseNextRunCheck = false;
        runCheckReached();
        await reservationPaused;
      }
      return runs;
    };
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus(), {
      generalWorkingDirectory,
    });

    const start = orchestrator.startTask(task.id);
    await runCheckPaused;
    await repository.setTaskWorkflow(task.id, agents.map((agent) => agent.id));
    resumeReservation();

    await assert.rejects(start, /실행 예약 중 Task Workflow가 변경되었습니다/);
    assert.equal((await repository.listWorkflowSteps(task.id)).length, 2);
    assert.equal((await repository.getTask(task.id))?.status, "todo");
    assert.equal((await originalListRuns(task.id)).length, 0);
  } finally {
    repository.close();
  }
});

test("rolls back retry reservation when activity persistence fails", async () => {
  const database = openDatabase(":memory:");
  const repository = new Repository(database);
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const firstAgent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Reviewer",
      role: "Review",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const failedAgent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Build",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Retry atomically",
      assigneeAgentId: firstAgent.id,
    });
    const steps = await repository.setTaskWorkflow(task.id, [firstAgent.id, failedAgent.id]);
    await repository.transitionTask(task.id, "working");
    const failedRun = await repository.createRun({
      id: "failed-run",
      taskId: task.id,
      agentId: failedAgent.id,
      runtime: "codex",
      scopeType: "general",
      workingDirectory: generalWorkingDirectory,
      cleanupPolicy: "preserve",
    });
    await repository.updateRun(failedRun.id, { status: "failed", error: "failed" });
    await repository.updateWorkflowStep(steps[1]!.id, {
      status: "failed",
      runId: failedRun.id,
    });
    await repository.transitionTask(task.id, "failed");
    database.exec(`CREATE TRIGGER fail_task_started BEFORE INSERT ON activity_logs
      WHEN NEW.type = 'task_started' BEGIN SELECT RAISE(ABORT, 'injected activity failure'); END`);
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus(), {
      generalWorkingDirectory,
    });

    await assert.rejects(() => orchestrator.retryTask(task.id), /injected activity failure/);

    assert.equal((await repository.getTask(task.id))?.status, "failed");
    assert.equal((await repository.getTask(task.id))?.assigneeAgentId, firstAgent.id);
    assert.equal((await repository.listWorkflowSteps(task.id))[1]?.status, "failed");
    assert.equal((await repository.listWorkflowSteps(task.id))[1]?.runId, failedRun.id);
    assert.equal((await repository.listRuns(task.id)).length, 1);
  } finally {
    repository.close();
  }
});

test("rolls back a change request when activity persistence fails", async () => {
  const database = openDatabase(":memory:");
  const repository = new Repository(database);
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Build",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Revise atomically",
      assigneeAgentId: agent.id,
    });
    await repository.transitionTask(task.id, "working");
    const previousRun = await repository.createRun({
      id: "completed-run",
      taskId: task.id,
      agentId: agent.id,
      runtime: "codex",
      scopeType: "general",
      workingDirectory: generalWorkingDirectory,
      cleanupPolicy: "preserve",
    });
    await repository.updateRun(previousRun.id, {
      status: "completed",
      result: { summary: "Done" },
    });
    await repository.transitionTask(task.id, "needs_review", { summary: "Done" });
    const activityCount = (await repository.listActivities(workspace.id)).length;
    database.exec(`CREATE TRIGGER fail_change_requested BEFORE INSERT ON activity_logs
      WHEN NEW.type = 'change_requested' BEGIN SELECT RAISE(ABORT, 'injected activity failure'); END`);
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus(), {
      generalWorkingDirectory,
    });

    await assert.rejects(
      () => orchestrator.requestChanges(task.id, "다시 확인해 주세요"),
      /injected activity failure/,
    );

    assert.equal((await repository.getTask(task.id))?.status, "needs_review");
    assert.equal((await repository.listRuns(task.id)).length, 1);
    assert.equal((await repository.listReviews(task.id)).length, 0);
    assert.equal((await repository.listActivities(workspace.id)).length, activityCount);
  } finally {
    repository.close();
  }
});

test("routes a Claude agent through the runtime contract", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  let selectedRuntime = "";
  let selectedDirectory = "";
  const runtime: RuntimeAdapter = {
    async run(input, callbacks) {
      selectedRuntime = input.runtime;
      selectedDirectory = input.cwd;
      const completed = { type: "completed", result: { summary: "Claude result" } } as const;
      callbacks.onEvent({ type: "started", threadId: "claude-session" });
      callbacks.onEvent(completed);
      return {
        runId: input.runId,
        threadId: "claude-session",
        turnId: input.runId,
        events: [completed],
      };
    },
    cancel: () => false,
    resolveApproval: () => false,
  };
  try {
    const workspace = await repository.createWorkspace({
      name: "Studio",
      workingDirectory: process.cwd(),
    });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Claude Reviewer",
      role: "Review UI",
      model: "claude",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Review checkout",
      assigneeAgentId: agent.id,
    });
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory,
    });
    await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
    assert.equal(selectedRuntime, "claude");
    assert.equal(selectedDirectory, generalWorkingDirectory);
    assert.equal((await repository.latestRun(task.id))?.scopeType, "general");
    assert.equal((await repository.getTask(task.id))?.result?.summary, "Claude result");
  } finally {
    repository.close();
  }
});

test("uses only the selected project folder for a project-scoped run", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  let selectedDirectory = "";
  const runtime: RuntimeAdapter = {
    async run(input, callbacks) {
      selectedDirectory = input.cwd;
      const completed = { type: "completed", result: { summary: "Done" } } as const;
      callbacks.onEvent({ type: "started", threadId: "thread" });
      callbacks.onEvent(completed);
      return { runId: input.runId, threadId: "thread", turnId: input.runId, events: [completed] };
    },
    cancel: () => false,
    resolveApproval: () => false,
  };
  try {
    const workspace = await repository.createWorkspace({
      name: "Studio",
      workingDirectory: process.cwd(),
    });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Build",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
      workingDirectory: process.cwd(),
    });
    const project = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "Product",
      path: process.cwd(),
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Build",
      assigneeAgentId: agent.id,
      workingDirectory: process.cwd(),
      projectId: project.id,
    });
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory,
    });
    await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
    assert.equal(selectedDirectory, process.cwd());
    assert.equal((await repository.latestRun(task.id))?.scopeType, "project");
    assert.equal((await repository.latestRun(task.id))?.scopeProjectId, project.id);
    const otherProject = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "Other",
      path: generalWorkingDirectory,
    });
    await assert.rejects(
      () => repository.updateTask(task.id, { projectId: otherProject.id }),
      /실행 이력이 있는 작업의 프로젝트는 변경할 수 없습니다/,
    );
    await assert.rejects(
      () => repository.updateProject(project.id, { path: generalWorkingDirectory }),
      /실행 이력이 있는 프로젝트의 폴더는 변경할 수 없습니다/,
    );
    await assert.rejects(
      () => repository.deleteProjectDirectory(project.id),
      /연결된 작업이 있는 프로젝트는 삭제할 수 없습니다/,
    );
  } finally {
    repository.close();
  }
});

test("does not fall back to a workspace folder when the general folder is missing", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({
      name: "Studio",
      workingDirectory: process.cwd(),
    });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Build",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Build",
      assigneeAgentId: agent.id,
    });
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus(), {
      generalWorkingDirectory: "Z:\\missing-ai-pixel-office-folder",
    });
    await assert.rejects(
      () => orchestrator.startTask(task.id),
      /일반 대화 폴더를 찾을 수 없습니다/,
    );
    assert.equal((await repository.listRuns(task.id)).length, 0);
    assert.equal((await repository.getTask(task.id))?.status, "todo");
  } finally {
    repository.close();
  }
});

test("validates retry and change request scope before writing state", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Developer",
      role: "Build",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const createPreviousRun = async (title: string, status: "failed" | "needs_review") => {
      const task = await repository.createTask({
        workspaceId: workspace.id,
        title,
        assigneeAgentId: agent.id,
      });
      await repository.transitionTask(task.id, "working");
      const run = await repository.createRun({
        id: `${title}-run`,
        taskId: task.id,
        agentId: agent.id,
        runtime: "codex",
        scopeType: "general",
        workingDirectory: generalWorkingDirectory,
        cleanupPolicy: "preserve",
      });
      await repository.updateRun(run.id, {
        status: status === "failed" ? "failed" : "completed",
        ...(status === "failed" ? { error: "failed" } : { result: { summary: "Done" } }),
      });
      await repository.transitionTask(
        task.id,
        status,
        status === "needs_review" ? { summary: "Done" } : undefined,
      );
      return task;
    };
    const failedTask = await createPreviousRun("retry", "failed");
    const reviewTask = await createPreviousRun("review", "needs_review");
    const activityCount = (await repository.listActivities(workspace.id)).length;
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus(), {
      generalWorkingDirectory: "Z:\\missing-ai-pixel-office-folder",
    });

    await assert.rejects(() => orchestrator.retryTask(failedTask.id), /일반 대화 폴더/);
    assert.equal((await repository.getTask(failedTask.id))?.status, "failed");
    await assert.rejects(
      () => orchestrator.requestChanges(reviewTask.id, "다시 확인해 주세요"),
      /일반 대화 폴더/,
    );
    assert.equal((await repository.listReviews(reviewTask.id)).length, 0);
    assert.equal((await repository.listActivities(workspace.id)).length, activityCount);
    assert.equal((await repository.listRuns(reviewTask.id)).length, 1);
  } finally {
    repository.close();
  }
});

test("runs a conversational agent in its project folder without file or terminal permissions", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  let conversational = false;
  let selectedDirectory = "";
  const runtime: RuntimeAdapter = {
    async run(input, callbacks) {
      conversational = input.conversational;
      selectedDirectory = input.cwd;
      const completed = {
        type: "completed",
        result: { summary: "함께 아이디어를 정리했습니다." },
      } as const;
      callbacks.onEvent({ type: "started", threadId: "chat-thread" });
      callbacks.onEvent(completed);
      return {
        runId: input.runId,
        threadId: "chat-thread",
        turnId: input.runId,
        events: [completed],
      };
    },
    cancel: () => false,
    resolveApproval: () => false,
  };
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const project = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "Product",
      path: process.cwd(),
    });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Idea Partner",
      role: "Talk through ideas",
      model: "claude",
      mode: "chat",
      skillIds: [],
      permissions: {},
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "아이디어 정리",
      assigneeAgentId: agent.id,
      projectId: project.id,
    });
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory: "Z:\\invalid-chat-fallback",
    });
    await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
    assert.equal(conversational, true);
    assert.equal(selectedDirectory, process.cwd());
  } finally {
    repository.close();
  }
});

test("runs sequential agents and hands each result to the next step", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  const prompts: string[] = [];
  let call = 0;
  const runtime: RuntimeAdapter = {
    async run(input, callbacks) {
      prompts.push(input.prompt);
      call += 1;
      const completed = {
        type: "completed",
        result: { summary: `step-${call}-result` },
      } as const;
      callbacks.onEvent({ type: "started", threadId: `thread-${call}` });
      callbacks.onEvent(completed);
      return {
        runId: input.runId,
        threadId: `thread-${call}`,
        turnId: input.runId,
        events: [completed],
      };
    },
    cancel: () => false,
    resolveApproval: () => false,
  };
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const reviewer = await repository.createAgent({
      workspaceId: workspace.id,
      name: "UI Reviewer",
      role: "Analyze UI",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const developer = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Frontend Developer",
      role: "Implement UI",
      model: "claude",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Improve checkout",
      description: "Preserve the existing payment flow and add regression coverage.",
      assigneeAgentId: reviewer.id,
    });
    await repository.setTaskWorkflow(task.id, [reviewer.id, developer.id]);

    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory,
      concurrentRunLimit: 1,
    });
    await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");

    assert.equal((await repository.listRuns(task.id)).length, 2);
    assert.deepEqual(
      (await repository.listWorkflowSteps(task.id)).map((step) => step.status),
      ["completed", "completed"],
    );
    assert.match(prompts[1] ?? "", /step-1-result/);
    assert.match(
      prompts[0] ?? "",
      /Preserve the existing payment flow and add regression coverage/,
    );
    assert.equal((await repository.getTask(task.id))?.assigneeAgentId, developer.id);
    assert.equal((await repository.getTask(task.id))?.result?.summary, "step-2-result");
  } finally {
    repository.close();
  }
});

test("warns before the session limit and extends the existing runtime session", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  const published: string[] = [];
  const eventBus = new EventBus();
  const originalPublish = eventBus.publish.bind(eventBus);
  eventBus.publish = (event) => {
    published.push(event.type);
    originalPublish(event);
  };
  let call = 0;
  let releaseFirstRun: (() => void) | undefined;
  const prompts: string[] = [];
  const resumedThreads: Array<string | undefined> = [];
  const runtime: RuntimeAdapter = {
    async run(input, callbacks) {
      call += 1;
      prompts.push(input.prompt);
      resumedThreads.push(input.resumeThreadId);
      callbacks.onEvent({ type: "started", threadId: `session-${call}` });
      if (call === 1) {
        await new Promise<void>((resolveRun) => {
          releaseFirstRun = resolveRun;
          callbacks.onEvent({ type: "message", content: "첫 단계 작업을 보존했습니다." });
          callbacks.onEvent({ type: "usage_updated", usage: { inputTokens: 80 } });
          callbacks.onEvent({ type: "usage_updated", usage: { inputTokens: 100 } });
        });
        const cancelled = { type: "cancelled", cleanupPolicy: "preserve" } as const;
        callbacks.onEvent(cancelled);
        return {
          runId: input.runId,
          threadId: "session-1",
          turnId: input.runId,
          events: [cancelled],
        };
      }
      const completed = { type: "completed", result: { summary: "이어하기 완료" } } as const;
      callbacks.onEvent(completed);
      return {
        runId: input.runId,
        threadId: "session-2",
        turnId: input.runId,
        events: [completed],
      };
    },
    cancel: () => {
      if (!releaseFirstRun) return false;
      const release = releaseFirstRun;
      releaseFirstRun = undefined;
      release();
      return true;
    },
    resolveApproval: () => false,
  };

  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Long Runner",
      role: "Continue safely",
      model: "codex",
      skillIds: [],
      permissions: { fileRead: true, terminal: true },
    });
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Large task",
      assigneeAgentId: agent.id,
    });
    const orchestrator = new Orchestrator(repository, runtime, eventBus, {
      generalWorkingDirectory,
      defaultRunLimits: {
        maxDurationMs: 1_000,
        idleTimeoutMs: 500,
        maxTurns: 100,
        maxTokens: 100,
      },
    });

    const firstRun = await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_input");
    assert.match((await repository.getRun(firstRun.id))?.error ?? "", /^SESSION_LIMIT:capacity:/);
    assert.ok(
      (await repository.listRunProgress(firstRun.id)).some(
        (event) => event.metadata?.kind === "session_limit_warning",
      ),
    );
    assert.ok(published.includes("session.limit_warning"));
    assert.ok(published.includes("session.limit_reached"));

    await orchestrator.extendTaskSession(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
    assert.equal((await repository.getTask(task.id))?.result?.summary, "이어하기 완료");
    assert.equal(resumedThreads[1], "session-1");
    assert.match(prompts[1] ?? "", /SAME WORK SESSION CONTINUATION/);
    assert.match(prompts[1] ?? "", /첫 단계 작업을 보존했습니다/);
  } finally {
    repository.close();
  }
});
