import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { AgentEvent } from "@ai-pixel-office/runtime-protocol";
import type { ResultFormat } from "@ai-pixel-office/domain";
import { EventBus } from "../apps/server/src/events.ts";
import { openDatabase } from "../apps/server/src/database.ts";
import { Orchestrator } from "../apps/server/src/orchestrator.ts";
import { Repository } from "../apps/server/src/repository/index.ts";
import { requiredFields } from "../apps/server/src/request-engine/output-contract.ts";
import {
  RequestWorkspaceService,
  runShellCommand,
  type CommandRunner,
} from "../apps/server/src/request-workspace-service.ts";
import type { RuntimeAdapter, RuntimeRunInput } from "../apps/server/src/runtime/index.ts";

async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for state change");
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}

function formattedResult(contract: "ux" | "ui" | "developer", userQuestions: string[] = []) {
  return Object.fromEntries(
    requiredFields(contract).map((field) => [
      field,
      field === "user_questions" ? userQuestions : "ok",
    ]),
  );
}

/** 호출마다 정해 둔 동작을 순서대로 실행하는 runtime */
type Step = (input: RuntimeRunInput) => AgentEvent[];
function scriptedRuntime(steps: Step[], seen: RuntimeRunInput[]): RuntimeAdapter {
  return {
    async run(input, callbacks) {
      seen.push(input);
      const step = steps[seen.length - 1];
      if (!step) throw new Error(`No scripted behavior for call ${seen.length}`);
      const events: AgentEvent[] = [
        ...step(input),
        { type: "completed", result: { summary: `call ${seen.length}` } },
      ];
      callbacks.onEvent({ type: "started", threadId: `thread-${seen.length}` });
      for (const event of events) callbacks.onEvent(event);
      return { runId: input.runId, threadId: `thread-${seen.length}`, turnId: "turn", events };
    },
    cancel: () => false,
    resolveApproval: () => false,
  };
}

const report =
  (contract: "ux" | "ui" | "developer", userQuestions: string[] = []): Step =>
  () => [{ type: "result_reported", result: formattedResult(contract, userQuestions) }];

const editScreen =
  (text: string, checks: Array<[string, boolean]> = []): Step =>
  (input) => {
    writeFileSync(join(input.cwd, "screen.txt"), text);
    return [
      ...checks.map(
        ([command, succeeded]) => ({ type: "command_finished", command, succeeded }) as const,
      ),
      { type: "result_reported", result: formattedResult("developer") },
    ];
  };

async function setup(
  options: { resultFormat?: ResultFormat; runCommand?: CommandRunner; setupCommand?: string } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-flow-"));
  const userProject = join(root, "user-app");
  mkdirSync(userProject);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: userProject });
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(userProject, "screen.txt"), "before\n");
  git("add", "-A");
  git("commit", "-qm", "init");

  const repository = new Repository(openDatabase(":memory:"));
  const workspace = await repository.createWorkspace({ name: "Studio" });
  const project = await repository.createProjectDirectory({
    workspaceId: workspace.id,
    name: "사용자 앱",
    path: userProject,
  });
  await repository.updateProject(project.id, { verificationCommands: ["pnpm test"] });
  const agent = await repository.createAgent({
    workspaceId: workspace.id,
    name: "단풍",
    role: "Developer",
    model: "claude",
    skillIds: [],
    permissions: { fileRead: true, fileWrite: true, terminal: true },
  });
  const task = await repository.createTask({
    workspaceId: workspace.id,
    title: "로그인 화면 개선",
    projectId: project.id,
    assigneeAgentId: agent.id,
    ...(options.resultFormat ? { resultFormat: options.resultFormat } : {}),
  });
  if (options.setupCommand)
    await repository.updateProject(project.id, { setupCommand: options.setupCommand });
  const requestWorkspaces = new RequestWorkspaceService(
    join(root, "workspaces"),
    options.runCommand ?? (async () => ({ exitCode: 0, output: "" })),
  );
  const cleanup = () => {
    repository.close();
    rmSync(root, { recursive: true, force: true });
  };
  return { root, userProject, repository, task, agent, requestWorkspaces, cleanup };
}

const statusOf = async (repository: Repository, taskId: string) =>
  (await repository.getTask(taskId))?.status;

test("W1: a user question pauses the request and the answer continues it in the same session", async () => {
  const flow = await setup({ resultFormat: "ux" });
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([report("ux", ["건너뛰기 버튼을 둘까요?"]), report("ux")], seen),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );

    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_input");
    const [question] = flow.repository.listTaskActivities(flow.task.id, "result_questions_asked");
    assert.deepEqual(question?.metadata?.questions, ["건너뛰기 버튼을 둘까요?"]);
    assert.equal(seen[0]!.resultReporting, true);

    await orchestrator.sendChatMessage(flow.task.id, "두 번째 화면부터 보여주세요");
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "done");

    assert.equal(seen.length, 2);
    assert.equal(seen[1]!.resumeThreadId, "thread-1");
    assert.match(seen[1]!.prompt, /두 번째 화면부터 보여주세요/);
  } finally {
    flow.cleanup();
  }
});

test("W1: a failed check goes back to the same colleague once, then approval applies the change", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime(
        [
          editScreen("broken\n", [["pnpm test", false]]),
          editScreen("after\n", [["pnpm run test", true]]),
        ],
        seen,
      ),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );

    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");

    assert.equal(seen.length, 2);
    assert.match(seen[1]!.prompt, /PROJECT CHECK FAILED/);
    assert.equal(seen[1]!.resumeThreadId, "thread-1");
    assert.equal(readFileSync(join(flow.userProject, "screen.txt"), "utf8"), "before\n");

    await orchestrator.approveTask(flow.task.id);

    assert.equal(await statusOf(flow.repository, flow.task.id), "done");
    assert.equal(readFileSync(join(flow.userProject, "screen.txt"), "utf8"), "after\n");
    assert.equal(existsSync(seen[0]!.cwd), false);
  } finally {
    flow.cleanup();
  }
});

test("W1: a check that fails again stops the request for the user", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime(
        [
          editScreen("broken\n", [["pnpm test", false]]),
          editScreen("still broken\n", [["pnpm test", false]]),
        ],
        [],
      ),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );

    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "blocked");

    assert.equal(flow.repository.listTaskActivities(flow.task.id, "verification_failed").length, 1);
  } finally {
    flow.cleanup();
  }
});

test("a request that changed no files finishes without approval and leaves no workspace", async () => {
  const flow = await setup();
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([() => []], seen),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );

    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "done");

    assert.equal(existsSync(seen[0]!.cwd), false);
    assert.equal(
      flow.repository.listTaskActivities(flow.task.id, "task_completed_without_changes").length,
      1,
    );
  } finally {
    flow.cleanup();
  }
});

test("approval refuses to apply over lines the user changed meanwhile", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([editScreen("after\n", [["pnpm test", true]])], []),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");
    writeFileSync(join(flow.userProject, "screen.txt"), "user edit\n");

    await assert.rejects(() => orchestrator.approveTask(flow.task.id), /겹쳐서/);

    assert.equal(readFileSync(join(flow.userProject, "screen.txt"), "utf8"), "user edit\n");
    assert.equal(await statusOf(flow.repository, flow.task.id), "needs_review");
  } finally {
    flow.cleanup();
  }
});

test("반려 goes back to the assignee in their session", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime(
        [
          editScreen("after\n", [["pnpm test", true]]),
          editScreen("after again\n", [["pnpm test", true]]),
        ],
        seen,
      ),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");

    await orchestrator.requestChanges(flow.task.id, "버튼 문구를 더 짧게");
    await waitFor(() => seen.length === 2);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");

    assert.equal(seen[1]!.resumeThreadId, "thread-1");
    assert.match(seen[1]!.prompt, /REVISION REQUEST\n버튼 문구를 더 짧게/);
    assert.equal((await flow.repository.listReviews(flow.task.id))[0]?.action, "changes_requested");
  } finally {
    flow.cleanup();
  }
});

test("reopening a finished request continues in the selected run's session", async () => {
  const flow = await setup({ resultFormat: "ux" });
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([report("ux"), report("ux")], seen),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "done");
    const [firstRun] = await flow.repository.listRuns(flow.task.id);

    await orchestrator.resumeTaskSession(flow.task.id, firstRun!.id, "흐름을 한 번 더 봐줘");
    await waitFor(() => seen.length === 2);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "done");

    assert.equal(seen[1]!.resumeThreadId, "thread-1");
    assert.equal((await flow.repository.latestRun(flow.task.id))?.agentId, flow.agent.id);
  } finally {
    flow.cleanup();
  }
});

test("approval never completes silently when the project's Git cannot be read anymore", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([editScreen("after\n", [["pnpm test", true]])], []),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");
    renameSync(join(flow.userProject, ".git"), join(flow.userProject, ".git-moved"));

    await assert.rejects(() => orchestrator.approveTask(flow.task.id));

    assert.equal(await statusOf(flow.repository, flow.task.id), "needs_review");
    assert.equal(readFileSync(join(flow.userProject, "screen.txt"), "utf8"), "before\n");
    renameSync(join(flow.userProject, ".git-moved"), join(flow.userProject, ".git"));
  } finally {
    flow.cleanup();
  }
});

test("a second approval while the first is being applied is refused", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([editScreen("after\n", [["pnpm test", true]])], []),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");

    const results = await Promise.allSettled([
      orchestrator.approveTask(flow.task.id),
      orchestrator.approveTask(flow.task.id),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await statusOf(flow.repository, flow.task.id), "done");
  } finally {
    flow.cleanup();
  }
});

test("files the setup command creates are not counted as the colleague's changes", async () => {
  const flow = await setup({
    resultFormat: "developer",
    setupCommand: "npm install",
    runCommand: async (_command, cwd) => {
      writeFileSync(join(cwd, "package-lock.json"), "{}");
      return { exitCode: 0, output: "" };
    },
  });
  try {
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([report("developer")], []),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );

    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "done");

    assert.equal(existsSync(join(flow.userProject, "package-lock.json")), false);
  } finally {
    flow.cleanup();
  }
});

test("answering a question reminds the colleague to submit the result again", async () => {
  const flow = await setup({ resultFormat: "ux" });
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([report("ux", ["로그인은 필수인가요?"]), report("ux")], seen),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_input");

    await orchestrator.sendChatMessage(flow.task.id, "필수예요");
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "done");

    assert.match(seen[1]!.prompt, /필수예요\n\nRESULT/);
  } finally {
    flow.cleanup();
  }
});

test("cancelling the setup command stops it right away", async () => {
  const controller = new AbortController();
  const started = Date.now();
  const pending = runShellCommand(
    'node -e "setTimeout(() => {}, 60000)"',
    tmpdir(),
    120_000,
    controller.signal,
  );
  setTimeout(() => controller.abort(), 300);

  const result = await pending;

  assert.equal(result.exitCode, -1);
  assert.ok(Date.now() - started < 10_000);
});

test("realigning after a conflict hands the overlap to the colleague, then approval applies", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime(
        [
          editScreen("agent\n", [["pnpm test", true]]),
          (input) => {
            assert.match(readFileSync(join(input.cwd, "screen.txt"), "utf8"), /<<<<<<<|>>>>>>>/);
            return editScreen("agent and user\n", [["pnpm test", true]])(input);
          },
        ],
        seen,
      ),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");
    writeFileSync(join(flow.userProject, "screen.txt"), "user\n");
    await assert.rejects(() => orchestrator.approveTask(flow.task.id), /겹쳐서/);

    await orchestrator.realignRequest(flow.task.id);
    await waitFor(() => seen.length === 2);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");
    assert.match(seen[1]!.prompt, /REALIGNED ON THE LATEST PROJECT STATE\n[\s\S]*- screen\.txt/);
    assert.equal(readFileSync(join(flow.userProject, "screen.txt"), "utf8"), "user\n");

    await orchestrator.approveTask(flow.task.id);
    assert.equal(readFileSync(join(flow.userProject, "screen.txt"), "utf8"), "agent and user\n");
  } finally {
    flow.cleanup();
  }
});

test("realigning without overlap lets the request be approved right away", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([editScreen("agent\n", [["pnpm test", true]])], seen),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");
    writeFileSync(join(flow.userProject, "other.txt"), "user's other file\n");

    await orchestrator.realignRequest(flow.task.id);
    await orchestrator.approveTask(flow.task.id);

    assert.equal(seen.length, 1);
    assert.equal(readFileSync(join(flow.userProject, "screen.txt"), "utf8"), "agent\n");
    assert.equal(readFileSync(join(flow.userProject, "other.txt"), "utf8"), "user's other file\n");
  } finally {
    flow.cleanup();
  }
});

test("a finished request shows its changed files and check results for review", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([editScreen("after\n", [["pnpm test", true]])], []),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");

    assert.deepEqual(await orchestrator.requestWorkspaceChanges(flow.task.id), {
      isolated: true,
      inside: [{ status: "modified", path: "screen.txt" }],
      outside: [],
    });
    assert.deepEqual(
      (await flow.repository.latestRun(flow.task.id))?.result?.metadata?.verifications,
      [{ command: "pnpm test", passed: true }],
    );
  } finally {
    flow.cleanup();
  }
});

test("files attached when a request starts reach the colleague", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const seen: RuntimeRunInput[] = [];
    const runtime = scriptedRuntime([editScreen("after\n", [["pnpm test", true]])], seen);
    const orchestrator = new Orchestrator(flow.repository, runtime, new EventBus(), {
      generalWorkingDirectory: tmpdir(),
      requestWorkspaces: flow.requestWorkspaces,
    });
    const attachment = flow.repository.createAttachment({
      id: "attachment-1",
      workspaceId: flow.task.workspaceId,
      taskId: flow.task.id,
      name: "login-sketch.png",
      mediaType: "image/png",
      size: 10,
      source: "file",
      storagePath: "attachments/login-sketch.png",
      createdAt: new Date().toISOString(),
    });

    await orchestrator.startTask(flow.task.id, [attachment.id]);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");

    assert.match(seen[0]!.prompt, /login-sketch\.png/);
  } finally {
    flow.cleanup();
  }
});

test("before approval, a changed file's diff can be read from the request workspace", async () => {
  const flow = await setup({ resultFormat: "developer" });
  try {
    const orchestrator = new Orchestrator(
      flow.repository,
      scriptedRuntime([editScreen("after\n", [["pnpm test", true]])], []),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces: flow.requestWorkspaces },
    );
    await orchestrator.startTask(flow.task.id);
    await waitFor(async () => (await statusOf(flow.repository, flow.task.id)) === "needs_review");

    const diff = await orchestrator.requestWorkspaceFileDiff(flow.task.id, "screen.txt");

    assert.match(diff, /^-before$/m);
    assert.match(diff, /^\+after$/m);
    await assert.rejects(() =>
      orchestrator.requestWorkspaceFileDiff(flow.task.id, "../outside.txt"),
    );
  } finally {
    flow.cleanup();
  }
});
