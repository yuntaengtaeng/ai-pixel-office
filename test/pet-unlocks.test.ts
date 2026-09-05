import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../apps/server/src/database.ts";
import { Repository } from "../apps/server/src/repository/index.ts";

test("미션 달성 시 신규 펫을 워크스페이스에 영구 해금한다", async () => {
  const repository = new Repository(openDatabase(":memory:"));
  try {
    const workspace = await repository.createWorkspace({ name: "Studio" });
    const initial = await repository.getPetUnlockProgress(workspace.id);
    assert.equal(
      initial.every((item) => !item.unlocked),
      true,
    );
    await assert.rejects(
      repository.createAgent({
        workspaceId: workspace.id,
        name: "잠금 우회",
        role: "테스트",
        model: "codex",
        avatarId: "rabbit-yuzu",
        skillIds: [],
        permissions: {},
      }),
      /아직 해금되지 않은 캐릭터/,
    );
    await assert.rejects(
      repository.getPetUnlockProgress("missing-workspace"),
      /Workspace not found/,
    );

    const project = await repository.createProjectDirectory({
      workspaceId: workspace.id,
      name: "App",
      path: process.cwd(),
    });
    const firstAgent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "첫째",
      role: "개발",
      model: "codex",
      skillIds: [],
      permissions: {},
    });
    const secondAgent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "둘째",
      role: "검토",
      model: "codex",
      skillIds: [],
      permissions: {},
    });

    for (let index = 0; index < 10; index += 1) {
      const task = await repository.createTask({
        workspaceId: workspace.id,
        title: `업무 ${index + 1}`,
        assigneeAgentId: firstAgent.id,
      });
      if (index === 0) {
        await repository.setTaskWorkflow(task.id, [firstAgent.id, secondAgent.id]);
      }
      await repository.transitionTask(task.id, "working");
      await repository.transitionTask(task.id, "needs_review");
      await repository.transitionTask(task.id, "done");
    }

    await repository.deleteProjectDirectory(project.id);
    const achieved = await repository.getPetUnlockProgress(workspace.id);
    assert.deepEqual(
      achieved.map((item) => [item.petId, item.unlocked]),
      [
        ["rabbit-yuzu", true],
        ["capybara-gamja", true],
        ["quokka-bangul", true],
      ],
    );
    const persisted = await repository.getPetUnlockProgress(workspace.id);
    assert.equal(persisted.find((item) => item.petId === "capybara-gamja")?.unlocked, true);
  } finally {
    repository.close();
  }
});
