import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { locateProjectRepository } from "../apps/server/src/project-snapshot.ts";
import {
  applyRequestWorkspace,
  assertRelativeInside,
  copyIntoRequestWorkspace,
  createRequestWorkspace,
  discardRequestWorkspace,
  listRequestWorkspaceChanges,
  openRequestWorkspace,
  type RequestWorkspaceAddress,
} from "../apps/server/src/request-workspace.ts";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "core.safecrlf=false", ...args], { cwd, encoding: "utf8" });
}

type Sandbox = { root: string; user: string; workspacesRoot: string };

function createSandbox({ identity = true }: { identity?: boolean } = {}): Sandbox {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-request-"));
  const user = join(root, "user");
  mkdirSync(user);
  git(user, "init", "-q");
  git(user, "config", "core.autocrlf", "true");
  git(user, "config", "user.email", "test@example.com");
  git(user, "config", "user.name", "test");
  writeFileSync(join(user, ".gitignore"), "node_modules/\n.env.local\n");
  writeFileSync(join(user, "a.txt"), "a1\n");
  writeFileSync(join(user, "b.txt"), "b1\nb2\nb3\n");
  git(user, "add", "-A");
  git(user, "commit", "-qm", "init");
  if (!identity) {
    git(user, "config", "--unset", "user.email");
    git(user, "config", "--unset", "user.name");
  }
  return { root, user, workspacesRoot: join(root, "appdata", "workspaces") };
}

async function addressFor(
  sandbox: Sandbox,
  projectPath = sandbox.user,
  taskId = "task-1",
): Promise<RequestWorkspaceAddress> {
  const project = await locateProjectRepository(projectPath);
  assert.ok(project);
  return { project, workspacesRoot: sandbox.workspacesRoot, projectId: "project-1", taskId };
}

const read = (path: string) => readFileSync(path, "utf8");

test("starts from the user's folder as it is now, without touching their index or branches", async () => {
  const sandbox = createSandbox();
  try {
    writeFileSync(join(sandbox.user, "a.txt"), "a1 uncommitted\n");
    writeFileSync(join(sandbox.user, "c.txt"), "untracked\n");
    mkdirSync(join(sandbox.user, "node_modules"));
    writeFileSync(join(sandbox.user, ".env.local"), "SECRET=1\n");
    const statusBefore = git(sandbox.user, "status", "--porcelain");
    const branchesBefore = git(sandbox.user, "branch", "--list");

    const workspace = await createRequestWorkspace(await addressFor(sandbox));

    assert.equal(read(join(workspace.runDirectory, "a.txt")), "a1 uncommitted\n");
    assert.equal(existsSync(join(workspace.runDirectory, "c.txt")), true);
    assert.equal(existsSync(join(workspace.runDirectory, "node_modules")), false);
    assert.equal(existsSync(join(workspace.runDirectory, ".env.local")), false);
    assert.equal(git(sandbox.user, "status", "--porcelain"), statusBefore);
    assert.equal(git(sandbox.user, "branch", "--list"), branchesBefore);
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("lists what the colleague changed and applies it to the user's folder without a commit", async () => {
  const sandbox = createSandbox();
  try {
    writeFileSync(join(sandbox.user, "a.txt"), "a1 uncommitted\n");
    writeFileSync(join(sandbox.user, "c.txt"), "untracked\n");
    const workspace = await createRequestWorkspace(await addressFor(sandbox));

    writeFileSync(join(workspace.runDirectory, "b.txt"), "b1\nb2 agent\nb3\n");
    writeFileSync(join(workspace.runDirectory, "crlf.txt"), "windows line\r\n");
    rmSync(join(workspace.runDirectory, "c.txt"));
    mkdirSync(join(workspace.runDirectory, "node_modules"));
    writeFileSync(join(workspace.runDirectory, "node_modules", "x.js"), "installed\n");

    const changes = await listRequestWorkspaceChanges(workspace);
    assert.deepEqual(changes.inside.map((change) => `${change.status}:${change.path}`).sort(), [
      "added:crlf.txt",
      "deleted:c.txt",
      "modified:b.txt",
    ]);
    assert.deepEqual(changes.outside, []);

    const result = await applyRequestWorkspace(workspace);
    assert.equal(result.status, "applied");
    assert.equal(read(join(sandbox.user, "b.txt")), "b1\nb2 agent\nb3\n");
    assert.equal(read(join(sandbox.user, "crlf.txt")), "windows line\r\n");
    assert.equal(existsSync(join(sandbox.user, "c.txt")), false);
    assert.equal(read(join(sandbox.user, "a.txt")), "a1 uncommitted\n");
    assert.equal(git(sandbox.user, "rev-list", "--count", "HEAD").trim(), "1");
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("refuses to apply when the user changed the same lines meanwhile, leaving their folder untouched", async () => {
  const sandbox = createSandbox();
  try {
    const workspace = await createRequestWorkspace(await addressFor(sandbox));
    writeFileSync(join(workspace.runDirectory, "b.txt"), "b1\nb2 agent\nb3\n");
    writeFileSync(join(sandbox.user, "b.txt"), "b1\nb2 user meanwhile\nb3\n");

    const result = await applyRequestWorkspace(workspace);

    assert.equal(result.status, "conflict");
    assert.equal(read(join(sandbox.user, "b.txt")), "b1\nb2 user meanwhile\nb3\n");
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("reports nothing to apply when the colleague changed nothing", async () => {
  const sandbox = createSandbox();
  try {
    const workspace = await createRequestWorkspace(await addressFor(sandbox));

    assert.deepEqual(await applyRequestWorkspace(workspace), { status: "empty" });
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("keeps changes outside the project folder out of the user's folder", async () => {
  const sandbox = createSandbox();
  try {
    const projectPath = join(sandbox.user, "apps", "web");
    mkdirSync(projectPath, { recursive: true });
    writeFileSync(join(projectPath, "page.txt"), "page\n");
    git(sandbox.user, "add", "-A");
    git(sandbox.user, "commit", "-qm", "web");
    const workspace = await createRequestWorkspace(await addressFor(sandbox, projectPath));

    writeFileSync(join(workspace.runDirectory, "page.txt"), "page changed\n");
    writeFileSync(join(workspace.root, "a.txt"), "outside changed\n");

    const changes = await listRequestWorkspaceChanges(workspace);
    assert.deepEqual(changes.inside, [{ status: "modified", path: "apps/web/page.txt" }]);
    assert.deepEqual(changes.outside, [{ status: "modified", path: "a.txt" }]);

    await applyRequestWorkspace(workspace);
    assert.equal(read(join(projectPath, "page.txt")), "page changed\n");
    assert.equal(read(join(sandbox.user, "a.txt")), "a1\n");
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("discarding removes the workspace and its reference, leaving the user's folder as it was", async () => {
  const sandbox = createSandbox();
  try {
    const address = await addressFor(sandbox);
    const workspace = await createRequestWorkspace(address);
    writeFileSync(join(workspace.runDirectory, "b.txt"), "agent\n");

    assert.ok(await openRequestWorkspace(address));
    await discardRequestWorkspace(address);

    assert.equal(await openRequestWorkspace(address), undefined);
    assert.equal(existsSync(workspace.root), false);
    assert.equal(git(sandbox.user, "worktree", "list").trim().split("\n").length, 1);
    assert.equal(read(join(sandbox.user, "b.txt")), "b1\nb2\nb3\n");
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("works in a repository whose user has no Git name or email set", async () => {
  const sandbox = createSandbox({ identity: false });
  try {
    const workspace = await createRequestWorkspace(await addressFor(sandbox));

    assert.equal(read(join(workspace.runDirectory, "a.txt")), "a1\n");
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("works in a repository that has no commits yet", async () => {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-request-empty-"));
  try {
    const user = join(root, "user");
    mkdirSync(user);
    git(user, "init", "-q");
    writeFileSync(join(user, "draft.txt"), "first\n");
    const project = await locateProjectRepository(user);
    assert.ok(project);

    const workspace = await createRequestWorkspace({
      project,
      workspacesRoot: join(root, "workspaces"),
      projectId: "project-1",
      taskId: "task-1",
    });

    assert.equal(read(join(workspace.runDirectory, "draft.txt")), "first\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("copies ignored files the project needs, such as local env files", async () => {
  const sandbox = createSandbox();
  try {
    writeFileSync(join(sandbox.user, ".env.local"), "SECRET=1\n");
    const workspace = await createRequestWorkspace(await addressFor(sandbox));

    await copyIntoRequestWorkspace(workspace, sandbox.user, [".env.local", "missing.env"]);

    assert.equal(read(join(workspace.runDirectory, ".env.local")), "SECRET=1\n");
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("only accepts copy paths that stay inside the project folder", () => {
  assert.equal(assertRelativeInside(".env.local"), ".env.local");
  assert.throws(() => assertRelativeInside("../secrets"));
  assert.throws(() => assertRelativeInside("/etc/passwd"));
  assert.throws(() => assertRelativeInside(""));
});
