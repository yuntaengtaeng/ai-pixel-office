import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  captureProjectSnapshot,
  diffProjectSnapshots,
  isInsideScope,
  locateProjectRepository,
  parseNameStatus,
} from "../apps/server/src/project-snapshot.ts";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "core.safecrlf=false", ...args], { cwd, encoding: "utf8" });
}

function createRepository(): string {
  const root = mkdtempSync(join(tmpdir(), "ai-pixel-snapshot-"));
  git(root, "init", "-q");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "test");
  git(root, "config", "core.autocrlf", "true");
  writeFileSync(join(root, ".gitignore"), "ignored/\n");
  writeFileSync(join(root, "a.txt"), "committed\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");
  return root;
}

test("captures the folder state without touching the user's index, HEAD or stash", async () => {
  const root = createRepository();
  try {
    writeFileSync(join(root, "a.txt"), "user edit\n");
    writeFileSync(join(root, "staged.txt"), "staged\n");
    git(root, "add", "staged.txt");
    writeFileSync(join(root, "untracked.txt"), "untracked\n");
    const statusBefore = git(root, "status", "--porcelain");
    const headBefore = git(root, "rev-parse", "HEAD");

    const location = await locateProjectRepository(root);
    assert.ok(location);
    await captureProjectSnapshot(location);

    assert.equal(git(root, "status", "--porcelain"), statusBefore);
    assert.equal(git(root, "rev-parse", "HEAD"), headBefore);
    assert.equal(git(root, "stash", "list"), "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports added, modified and deleted files between snapshots, ignoring ignored files", async () => {
  const root = createRepository();
  try {
    writeFileSync(join(root, "crlf.txt"), "windows line\r\n");
    writeFileSync(join(root, "untracked.txt"), "untracked\n");
    mkdirSync(join(root, "ignored"));
    const location = await locateProjectRepository(root);
    assert.ok(location);
    const before = await captureProjectSnapshot(location);

    writeFileSync(join(root, "a.txt"), "agent edit\n");
    writeFileSync(join(root, "crlf.txt"), "agent\n");
    rmSync(join(root, "untracked.txt"));
    writeFileSync(join(root, "new.txt"), "created by agent\n");
    writeFileSync(join(root, "ignored", "cache.txt"), "ignored output\n");

    const changes = await diffProjectSnapshots(
      location,
      before,
      await captureProjectSnapshot(location),
    );
    assert.deepEqual(changes.map((change) => `${change.status}:${change.path}`).sort(), [
      "added:new.txt",
      "deleted:untracked.txt",
      "modified:a.txt",
      "modified:crlf.txt",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("limits snapshots to a project folder inside a larger repository", async () => {
  const root = createRepository();
  try {
    const project = join(root, "apps", "web");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "page.txt"), "page\n");
    const location = await locateProjectRepository(project);
    assert.equal(location?.scope, "apps/web");
    assert.ok(location);
    const before = await captureProjectSnapshot(location);

    writeFileSync(join(project, "page.txt"), "changed\n");
    writeFileSync(join(root, "outside.txt"), "not part of the project\n");

    const changes = await diffProjectSnapshots(
      location,
      before,
      await captureProjectSnapshot(location),
    );
    assert.deepEqual(changes, [{ status: "modified", path: "apps/web/page.txt" }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("returns undefined for a folder that is not a Git repository", async () => {
  const folder = mkdtempSync(join(tmpdir(), "ai-pixel-no-git-"));
  try {
    assert.equal(await locateProjectRepository(folder), undefined);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("reads git name-status output, including paths with spaces", () => {
  assert.deepEqual(parseNameStatus("A\0new file.txt\0M\0a.txt\0D\0old.txt\0"), [
    { status: "added", path: "new file.txt" },
    { status: "modified", path: "a.txt" },
    { status: "deleted", path: "old.txt" },
  ]);
});

test("treats a path as inside the project only within the project folder", () => {
  assert.equal(isInsideScope("apps/web/page.txt", "apps/web"), true);
  assert.equal(isInsideScope("apps/web", "apps/web"), true);
  assert.equal(isInsideScope("apps/website/page.txt", "apps/web"), false);
  assert.equal(isInsideScope("anything.txt", ""), true);
});
