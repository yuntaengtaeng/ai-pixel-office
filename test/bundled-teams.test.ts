import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  installBundledTeam,
  loadBundledTeams,
  planTeamAgents,
} from "../apps/server/src/bundled-teams.ts";
import { openDatabase } from "../apps/server/src/database.ts";
import { Repository } from "../apps/server/src/repository/index.ts";
import { SkillLibrary } from "../apps/server/src/skill-library.ts";

const bundledTeamsDirectory = resolve("apps/server/resources/teams");

function productTeam() {
  const team = loadBundledTeams(bundledTeamsDirectory).find((item) => item.id === "product-team");
  assert.ok(team, "product-team package must exist");
  return team;
}

test("plans one colleague per Product Team member on the chosen runtime", () => {
  const agents = planTeamAgents(productTeam(), "workspace-1", "codex");

  assert.deepEqual(
    agents.map((agent) => agent.role),
    ["UX Designer", "UI Designer", "Developer"],
  );
  assert.ok(
    agents.every((agent) => agent.model === "codex" && agent.sourceTeam === "product-team@0.1.0"),
  );
  assert.equal(agents.find((agent) => agent.role === "Developer")?.permissions.fileWrite, true);
  assert.equal(
    agents.find((agent) => agent.role === "UX Designer")?.permissions.fileWrite,
    undefined,
  );
});

test("installs Product Team once: skills and colleagues", async (context) => {
  const libraryRoot = mkdtempSync(join(tmpdir(), "ai-pixel-team-"));
  context.after(() => rmSync(libraryRoot, { recursive: true, force: true }));
  const repository = new Repository(openDatabase(":memory:"));
  const skillLibrary = new SkillLibrary(libraryRoot);
  const workspace = await repository.createWorkspace({ name: "Studio" });
  const team = productTeam();

  const first = await installBundledTeam(
    team,
    { workspaceId: workspace.id, runtime: "claude" },
    { repository, skillLibrary },
  );
  const second = await installBundledTeam(
    team,
    { workspaceId: workspace.id, runtime: "claude" },
    { repository, skillLibrary },
  );

  assert.equal(first.alreadyInstalled, false);
  assert.equal(first.agents.length, 3);
  assert.ok(skillLibrary.list().every((skill) => skill.source === "bundled"));
  assert.ok(first.agents.every((agent) => agent.skillIds.every((id) => skillLibrary.has(id))));
  assert.equal(second.alreadyInstalled, true);
  assert.equal((await repository.listAgents(workspace.id)).length, 3);
});

test("keeps the screen improvement order as a guide for the project lead", () => {
  const [guide] = productTeam().workflowGuides;

  assert.equal(guide?.name, "화면 개선 요청");
  assert.deepEqual(
    guide?.steps.map((step) => [step.member, step.resultFormat, step.modifiesFiles]),
    [
      ["ux-designer", "ux", false],
      ["ui-designer", "ui", false],
      ["developer", "developer", true],
    ],
  );
});

test("keeps the bundled skills identical to the product-team source", () => {
  assert.doesNotThrow(() =>
    execFileSync(
      "node",
      ["ai-docs/pixel-office-product-team/scripts/build-app-bundle.mjs", "--check"],
      {
        stdio: "pipe",
      },
    ),
  );
});
