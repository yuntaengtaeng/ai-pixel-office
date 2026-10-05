import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { openDatabase } from "../apps/server/src/database.ts";
import { Repository } from "../apps/server/src/repository/index.ts";
import { parseBundledTeam } from "../apps/server/src/bundled-teams.ts";
import { envFilesToCopy, suggestProjectSetup } from "../apps/server/src/project-setup.ts";

async function workspaceWithAgents(repository: Repository) {
  const workspace = await repository.createWorkspace({ name: "Studio" });
  const agent = (name: string) =>
    repository.createAgent({
      workspaceId: workspace.id,
      name,
      role: name,
      model: "claude",
      skillIds: [],
      permissions: { fileRead: true, fileWrite: true, terminal: false },
    });
  return { workspace, ux: await agent("라떼"), dev: await agent("단풍") };
}

test("stores a project's memo, checks, setup, files to copy, default assignee and preview address", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const { workspace, dev } = await workspaceWithAgents(repository);
    const project = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "사용자 앱",
      path: process.cwd(),
    });
    assert.deepEqual(project.verificationCommands, []);
    assert.deepEqual(project.copyFiles, []);

    await repository.updateProject(project.id, {
      memo: "글자는 크게",
      verificationCommands: ["pnpm typecheck", "pnpm test"],
      setupCommand: "pnpm install --frozen-lockfile",
      copyFiles: [".env.local"],
      defaultAgentId: dev.id,
      previewUrl: "http://localhost:5173",
    });

    const stored = await repository.getProject(project.id);
    assert.equal(stored?.memo, "글자는 크게");
    assert.deepEqual(stored?.verificationCommands, ["pnpm typecheck", "pnpm test"]);
    assert.equal(stored?.setupCommand, "pnpm install --frozen-lockfile");
    assert.deepEqual(stored?.copyFiles, [".env.local"]);
    assert.equal(stored?.defaultAgentId, dev.id);
    assert.equal(stored?.previewUrl, "http://localhost:5173");

    await repository.updateProject(project.id, { defaultAgentId: undefined });
    assert.equal((await repository.getProject(project.id))?.defaultAgentId, undefined);
  } finally {
    repository.close();
  }
});

test("adds the new columns to an existing database without losing its projects", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-pixel-migrate-"));
  const file = join(directory, "app.sqlite");
  try {
    const first = new Repository(openDatabase(file));
    const { workspace } = await workspaceWithAgents(first);
    await first.createProjectDirectory({
      workspaceId: workspace.id,
      name: "Admin",
      path: directory,
    });
    first.close();

    const legacy = openDatabase(file);
    for (const column of ["memo", "verification_commands_json", "setup_command", "copy_files_json"])
      legacy.exec(`ALTER TABLE projects DROP COLUMN ${column}`);
    legacy.close();

    const reopened = new Repository(openDatabase(file));
    try {
      const [project] = await reopened.listProjectDirectories(workspace.id);
      assert.equal(project?.name, "Admin");
      assert.deepEqual(project?.verificationCommands, []);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("reads team work orders written as stages or as a plain member list", () => {
  const members = [{ key: "ux" }, { key: "dev" }];
  const team = parseBundledTeam(
    {
      id: "team",
      version: "1.0.0",
      name: "Team",
      members,
      workflows: [
        { name: "staged", stages: [{ member: "ux", contract: "ux", modifiesFiles: false }] },
        { name: "plain", members: ["ux", "dev"] },
      ],
    },
    "/teams/team",
  );

  assert.deepEqual(team.workflowGuides[0]?.steps, [
    { member: "ux", resultFormat: "ux", modifiesFiles: false },
  ]);
  assert.deepEqual(
    team.workflowGuides[1]?.steps.map((step) => [step.member, step.modifiesFiles]),
    [
      ["ux", true],
      ["dev", true],
    ],
  );
  assert.throws(() =>
    parseBundledTeam(
      { id: "t", version: "1", name: "T", members, workflows: [{ name: "x", members: ["pm"] }] },
      "/teams/t",
    ),
  );
});

test("suggests check commands, a setup command and local env files from the project folder", async () => {
  const folder = mkdtempSync(join(tmpdir(), "ai-pixel-setup-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: folder });
    writeFileSync(
      join(folder, "package.json"),
      JSON.stringify({ scripts: { dev: "vite", typecheck: "tsc", test: "vitest" } }),
    );
    writeFileSync(join(folder, "pnpm-lock.yaml"), "");
    writeFileSync(join(folder, ".env.local"), "A=1");
    writeFileSync(join(folder, ".env.example"), "A=");

    assert.deepEqual(await suggestProjectSetup(folder), {
      isolated: true,
      setupCommand: "pnpm install --frozen-lockfile",
      verificationCommands: ["pnpm typecheck", "pnpm test"],
      copyFiles: [".env.local"],
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("treats only real local env files as files to copy", () => {
  assert.deepEqual(
    envFilesToCopy([".env", ".env.local", ".env.example", ".env.sample", "env.txt", ".envrc"]),
    [".env", ".env.local"],
  );
});
