import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EventBus } from "../apps/server/src/events.ts";
import { openDatabase } from "../apps/server/src/database.ts";
import { Orchestrator } from "../apps/server/src/orchestrator.ts";
import { Repository } from "../apps/server/src/repository/index.ts";
import {
  pruneRequestWorkspaces,
  RequestWorkspaceService,
  type CommandRunner,
} from "../apps/server/src/request-workspace-service.ts";
import type { RuntimeAdapter, RuntimeRunInput } from "../apps/server/src/runtime/index.ts";

async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for state change");
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}

function createUserRepository(root: string): string {
  const user = join(root, "user-project");
  mkdirSync(user);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: user });
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(user, "screen.txt"), "before\n");
  git("add", "-A");
  git("commit", "-qm", "init");
  return user;
}

/** 실행 경로의 screen.txt를 고치고 끝나는 runtime */
function editingRuntime(seen: RuntimeRunInput[]): RuntimeAdapter {
  return {
    async run(input, callbacks) {
      seen.push(input);
      writeFileSync(join(input.cwd, "screen.txt"), "after\n");
      const completed = { type: "completed", result: { summary: "done" } } as const;
      callbacks.onEvent({ type: "started", threadId: "thread-1" });
      callbacks.onEvent(completed);
      return { runId: input.runId, threadId: "thread-1", turnId: "turn-1", events: [completed] };
    },
    cancel: () => false,
    resolveApproval: () => false,
  };
}

async function setup(runCommand: CommandRunner) {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-orchestrator-ws-"));
  const userProject = createUserRepository(root);
  const repository = new Repository(openDatabase(":memory:"));
  const workspace = await repository.createWorkspace({ name: "Studio" });
  const agent = await repository.createAgent({
    workspaceId: workspace.id,
    name: "단풍",
    role: "Developer",
    model: "claude",
    skillIds: [],
    permissions: { fileRead: true, fileWrite: true, terminal: true },
  });
  const project = await repository.createProjectDirectory({
    workspaceId: workspace.id,
    name: "사용자 앱",
    path: userProject,
  });
  await repository.updateProject(project.id, { setupCommand: "pnpm install" });
  const task = await repository.createTask({
    workspaceId: workspace.id,
    title: "화면 문구 바꾸기",
    projectId: project.id,
    assigneeAgentId: agent.id,
  });
  const requestWorkspaces = new RequestWorkspaceService(join(root, "workspaces"), runCommand);
  return { root, userProject, repository, task, requestWorkspaces };
}

test("a project request runs in its own workspace and leaves the user's folder untouched", async () => {
  const commands: Array<{ command: string; cwd: string }> = [];
  const { root, userProject, repository, task, requestWorkspaces } = await setup(
    async (command, cwd) => {
      commands.push({ command, cwd });
      return { exitCode: 0, output: "" };
    },
  );
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(repository, editingRuntime(seen), new EventBus(), {
      generalWorkingDirectory: tmpdir(),
      requestWorkspaces,
    });

    await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status !== "working");

    assert.equal(seen.length, 1);
    assert.notEqual(seen[0]!.cwd, userProject);
    assert.ok(seen[0]!.cwd.startsWith(join(root, "workspaces")));
    assert.equal(readFileSync(join(seen[0]!.cwd, "screen.txt"), "utf8"), "after\n");
    assert.equal(readFileSync(join(userProject, "screen.txt"), "utf8"), "before\n");
    assert.deepEqual(commands, [{ command: "pnpm install", cwd: seen[0]!.cwd }]);
  } finally {
    repository.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failed setup command stops the request before the colleague starts", async () => {
  const { root, repository, task, requestWorkspaces } = await setup(async () => ({
    exitCode: 1,
    output: "ERR_PNPM_NO_LOCKFILE",
  }));
  try {
    const seen: RuntimeRunInput[] = [];
    const orchestrator = new Orchestrator(repository, editingRuntime(seen), new EventBus(), {
      generalWorkingDirectory: tmpdir(),
      requestWorkspaces,
    });

    await orchestrator.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status === "failed");

    assert.equal(seen.length, 0);
    const run = await repository.latestRun(task.id);
    assert.match(run?.error ?? "", /작업 공간을 준비하지 못했어요/);
    assert.match(run?.error ?? "", /ERR_PNPM_NO_LOCKFILE/);
  } finally {
    repository.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a request that already ran directly in the project folder keeps running there", async () => {
  const { root, userProject, repository, task, requestWorkspaces } = await setup(async () => ({
    exitCode: 0,
    output: "",
  }));
  try {
    const seen: RuntimeRunInput[] = [];
    const direct = new Orchestrator(repository, editingRuntime(seen), new EventBus(), {
      generalWorkingDirectory: tmpdir(),
    });
    await direct.startTask(task.id);
    await waitFor(async () => (await repository.getTask(task.id))?.status !== "working");
    const isolatedAfterUpgrade = new Orchestrator(
      repository,
      editingRuntime(seen),
      new EventBus(),
      { generalWorkingDirectory: tmpdir(), requestWorkspaces },
    );

    await isolatedAfterUpgrade.sendChatMessage(task.id, "한 번 더");
    await waitFor(() => seen.length === 2);

    assert.equal(seen[1]!.cwd, seen[0]!.cwd);
    assert.equal(existsSync(join(root, "workspaces")), false);
    assert.equal(readFileSync(join(userProject, "screen.txt"), "utf8"), "after\n");
  } finally {
    repository.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("startup cleanup removes workspaces of finished requests and keeps live ones", async () => {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-prune-"));
  try {
    const userProject = createUserRepository(root);
    const workspacesRoot = join(root, "workspaces");
    const service = new RequestWorkspaceService(workspacesRoot);
    const project = {
      id: "project-1",
      workspaceId: "ws",
      name: "app",
      status: "active",
      path: userProject,
      verificationCommands: [],
      copyFiles: [],
      createdAt: "",
      updatedAt: "",
    } as const;
    const live = await service.addressFor(project, "live-task");
    const finished = await service.addressFor(project, "finished-task");
    const liveWorkspace = await service.ensure(live!);
    const finishedWorkspace = await service.ensure(finished!);
    mkdirSync(join(workspacesRoot, "deleted-project", "orphan-task"), { recursive: true });

    const pruned = await pruneRequestWorkspaces(service, workspacesRoot, {
      isLive: async (taskId) => taskId === "live-task",
      addressOf: (taskId) =>
        taskId === "finished-task" ? finished : taskId === "live-task" ? live : undefined,
    });

    assert.equal(pruned, 2);
    assert.equal(existsSync(liveWorkspace.root), true);
    assert.equal(existsSync(finishedWorkspace.root), false);
    assert.equal(existsSync(join(workspacesRoot, "deleted-project", "orphan-task")), false);
    assert.equal(
      execFileSync("git", ["worktree", "list"], { cwd: userProject, encoding: "utf8" })
        .trim()
        .split("\n").length,
      2,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("in a folder that is not a Git repository, a second request queues and starts once the first is settled", async () => {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-busy-"));
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const folder = join(root, "design-notes");
    mkdirSync(folder);
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "모카",
      role: "UI",
      model: "claude",
      skillIds: [],
      permissions: { fileRead: true, fileWrite: true, terminal: true },
    });
    const project = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "디자인 노트",
      path: folder,
    });
    const createTask = (title: string) =>
      repository.createTask({
        workspaceId: workspace.id,
        title,
        projectId: project.id,
        assigneeAgentId: agent.id,
      });
    const first = await createTask("첫 번째 정리");
    const second = await createTask("두 번째 정리");
    const runtime: RuntimeAdapter = {
      async run(input, callbacks) {
        const events = [
          { type: "files_changed", paths: ["notes.md"] },
          { type: "completed", result: { summary: "정리함" } },
        ] as const;
        for (const event of events) callbacks.onEvent(event);
        return { runId: input.runId, threadId: "t", turnId: "t", events: [...events] };
      },
      cancel: () => false,
      resolveApproval: () => false,
    };
    const orchestrator = new Orchestrator(repository, runtime, new EventBus(), {
      generalWorkingDirectory: tmpdir(),
      requestWorkspaces: new RequestWorkspaceService(join(root, "workspaces")),
    });

    await orchestrator.startTask(first.id);
    await waitFor(async () => (await repository.getTask(first.id))?.status === "needs_review");

    const queued = await orchestrator.startTask(second.id);
    assert.ok("queued" in queued);
    assert.equal(queued.task.status, "todo");
    assert.equal(queued.task.queuedBehind, "첫 번째 정리");

    await orchestrator.approveTask(first.id);
    await waitFor(async () => (await repository.getTask(second.id))?.status === "needs_review");
    assert.equal((await repository.getTask(second.id))?.queuedBehind, undefined);
  } finally {
    repository.close();
    rmSync(root, { recursive: true, force: true });
  }
});
