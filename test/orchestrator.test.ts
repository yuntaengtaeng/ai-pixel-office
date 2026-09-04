import assert from "node:assert/strict";
import test from "node:test";
import { EventBus } from "../apps/server/src/events.ts";
import { openDatabase } from "../apps/server/src/database.ts";
import { Orchestrator } from "../apps/server/src/orchestrator.ts";
import { Repository } from "../apps/server/src/repository.ts";
import type {
  RuntimeAdapter,
  RuntimeCallbacks,
  RuntimeRunInput,
} from "../apps/server/src/runtime.ts";
import type { CodexSpikeResult } from "../scripts/runtime-spike/codex.ts";
import type { ApprovalDecision } from "../scripts/runtime-spike/types.ts";

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
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus());
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
    const orchestrator = new Orchestrator(repository, runtime, new EventBus());
    const run = await orchestrator.retryTask(task.id);
    await waitFor(async () => (await repository.getRun(run.id))?.status === "waiting");
    assert.equal((await repository.getTask(task.id))?.status, "needs_input");

    await orchestrator.resolveApproval(run.id, "approval-1", "accept");
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
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
    const orchestrator = new Orchestrator(repository, runtime, new EventBus());
    await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
    assert.equal(selectedRuntime, "claude");
    assert.equal(selectedDirectory, process.cwd());
    assert.equal((await repository.getTask(task.id))?.result?.summary, "Claude result");
  } finally {
    repository.close();
  }
});

test("uses task project folder before agent and workspace defaults", async () => {
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
    const task = await repository.createTask({
      workspaceId: workspace.id,
      title: "Build",
      assigneeAgentId: agent.id,
      workingDirectory: process.cwd(),
    });
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      workspacePath: "C:\\invalid-fallback",
    });
    await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "needs_review");
    assert.equal(selectedDirectory, process.cwd());
  } finally {
    repository.close();
  }
});

test("rejects a missing project folder before creating a run", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({
      name: "Studio",
      workingDirectory: "Z:\\missing-ai-pixel-office-folder",
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
    const orchestrator = new Orchestrator(repository, new ApprovalRuntime(), new EventBus());
    await assert.rejects(() => orchestrator.startTask(task.id), /프로젝트 폴더를 찾을 수 없습니다/);
    assert.equal((await repository.listRuns(task.id)).length, 0);
    assert.equal((await repository.getTask(task.id))?.status, "todo");
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
      workspacePath: "Z:\\invalid-chat-fallback",
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
