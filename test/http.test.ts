import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EventBus } from "../apps/server/src/events.ts";
import { createHttpServer } from "../apps/server/src/http.ts";
import { openDatabase } from "../apps/server/src/database.ts";
import { Orchestrator } from "../apps/server/src/orchestrator.ts";
import { Repository } from "../apps/server/src/repository/index.ts";
import {
  resolveGeneralWorkingDirectory,
  resolveRuntimeLogDirectory,
} from "../apps/server/src/index.ts";
import type { RuntimeAdapter } from "../apps/server/src/runtime/index.ts";
import { SkillLibrary } from "../apps/server/src/skill-library.ts";

const inactiveRuntime: RuntimeAdapter = {
  async run() {
    throw new Error("not used");
  },
  cancel() {
    return false;
  },
  resolveApproval() {
    return false;
  },
};

test("rejects a relative general working directory", () => {
  assert.throws(() => resolveGeneralWorkingDirectory("."), /absolute path/);
});

test("keeps runtime logs under an absolute application-owned directory", () => {
  const generalDirectory = join(tmpdir(), "ai-pixel-office", "general");
  assert.equal(
    resolveRuntimeLogDirectory(undefined, generalDirectory),
    join(generalDirectory, ".runtime-logs"),
  );
  assert.throws(
    () => resolveRuntimeLogDirectory(".runtime-logs", generalDirectory),
    /absolute path/,
  );
});

test("serves workspace, skill, agent, and task CRUD", async (context) => {
  const libraryDirectory = mkdtempSync(join(tmpdir(), "ai-pixel-library-"));
  context.after(() => rmSync(libraryDirectory, { recursive: true, force: true }));
  const repository = new Repository(openDatabase(":memory:"));
  const events = new EventBus();
  const orchestrator = new Orchestrator(repository, inactiveRuntime, events, {
    generalWorkingDirectory: tmpdir(),
  });
  const server = createHttpServer({
    repository,
    orchestrator,
    events,
    generalWorkingDirectory: tmpdir(),
    skillLibrary: new SkillLibrary(libraryDirectory),
    skillDraftGenerator: async (brief) => ({
      id: "ui-review",
      title: "UI Review",
      category: "Design",
      description: brief,
      instructions: "## 검토\n일관성을 확인합니다.",
      requiredPermissions: ["figma"],
    }),
  });
  const request = async (path: string, init?: RequestInit) => {
    const response = await server.inject({
      method: (init?.method ?? "GET") as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      url: path,
      headers: {
        ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers as Record<string, string> | undefined),
      },
      ...(typeof init?.body === "string" ? { payload: init.body } : {}),
    });
    const body =
      response.statusCode === 204 ? undefined : (response.json() as Record<string, unknown>);
    return { response, body };
  };

  try {
    const workspaceResponse = await request("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Studio", workingDirectory: process.cwd() }),
    });
    assert.equal(workspaceResponse.response.statusCode, 201);
    const workspace = workspaceResponse.body?.data as { id: string; workingDirectory?: string };
    assert.equal(workspace.workingDirectory, undefined);

    const projectResponse = await request("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: workspace.id,
        name: "Main app",
        description: "Ship the new app",
        figmaUrl: "https://figma.com/design/example",
        path: process.cwd(),
      }),
    });
    assert.equal(projectResponse.response.statusCode, 201);
    const project = projectResponse.body?.data as {
      id: string;
      description: string;
      status: string;
    };
    assert.equal(project.description, "Ship the new app");
    assert.equal(project.status, "active");
    const relativeProjectUpdate = await request(`/api/projects/${project.id}`, {
      method: "PATCH",
      body: JSON.stringify({ path: "." }),
    });
    assert.equal(relativeProjectUpdate.response.statusCode, 422);
    const projectUpdate = await request(`/api/projects/${project.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    });
    assert.equal((projectUpdate.body?.data as { status: string }).status, "paused");
    const projectList = await request(`/api/projects?workspaceId=${workspace.id}`);
    assert.equal((projectList.body?.data as unknown[]).length, 1);

    const directoryResponse = await request("/api/system/check-directory", {
      method: "POST",
      body: JSON.stringify({ path: process.cwd() }),
    });
    assert.equal(directoryResponse.response.statusCode, 200);
    assert.equal((directoryResponse.body?.data as { valid: boolean }).valid, true);

    const skillResponse = await request("/api/skills", {
      method: "POST",
      body: JSON.stringify({
        title: "React",
        category: "Frontend",
        description: "Build React UI",
        instructions: "Use TypeScript.",
        requiredPermissions: ["fileRead"],
      }),
    });
    const skill = skillResponse.body?.data as { id: string; source: string };
    assert.equal(skill.id, "react");
    assert.equal(skill.source, "local");

    const agentResponse = await request("/api/agents", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: workspace.id,
        name: "Frontend Developer",
        role: "Build interfaces",
        model: "codex",
        avatarId: "dog-corgi",
        skillIds: [skill.id],
        permissions: { fileRead: true },
        workingDirectory: process.cwd(),
      }),
    });
    const agent = agentResponse.body?.data as {
      id: string;
      avatarId: string;
      workingDirectory?: string;
    };
    assert.equal(agent.avatarId, "dog-corgi");
    assert.equal(agent.workingDirectory, undefined);

    const templateResponse = await request(`/api/agents/${agent.id}/task-templates`, {
      method: "POST",
      body: JSON.stringify({ title: "UI 검토", description: "화면 일관성을 검토해 줘" }),
    });
    assert.equal(templateResponse.response.statusCode, 201);
    const templates = await request(`/api/agents/${agent.id}/task-templates`);
    assert.equal((templates.body?.data as unknown[]).length, 1);

    const draftResponse = await request("/api/skills/draft", {
      method: "POST",
      body: JSON.stringify({ brief: "Figma 화면을 검토하는 스킬" }),
    });
    assert.equal(draftResponse.response.statusCode, 200);
    assert.equal((draftResponse.body?.data as { title: string }).title, "UI Review");

    const taskResponse = await request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: workspace.id,
        title: "Build login",
        assigneeAgentId: agent.id,
        projectId: project.id,
        resultFormat: "developer",
      }),
    });
    assert.equal(taskResponse.response.statusCode, 201);
    const task = taskResponse.body?.data as {
      id: string;
      status: string;
      projectId: string;
      resultFormat: string;
    };
    assert.equal(task.status, "todo");
    assert.equal(task.projectId, project.id);
    assert.equal(task.resultFormat, "developer");
    const detail = await request(`/api/tasks/${task.id}`);
    assert.equal(detail.response.statusCode, 200);
    assert.deepEqual((detail.body?.data as { runs: unknown[] }).runs, []);
    assert.deepEqual((detail.body?.data as { progress: unknown[] }).progress, []);
    const executionContext = await request(`/api/tasks/${task.id}/execution-context`);
    assert.equal(executionContext.response.statusCode, 200);
    const contexts = executionContext.body?.data as Array<{
      runtime: string;
      workingDirectory: string;
    }>;
    assert.deepEqual(
      contexts.map((context) => context.runtime),
      ["codex"],
    );
    assert.equal(contexts[0]?.workingDirectory, process.cwd());

    const invalid = await request("/api/agents", { method: "POST", body: "{}" });
    assert.equal(invalid.response.statusCode, 400);
    assert.equal((invalid.body?.error as { code: string }).code, "INVALID_FIELD");

    const projectDelete = await request(`/api/projects/${project.id}`, { method: "DELETE" });
    assert.equal(projectDelete.response.statusCode, 409);
    assert.equal((projectDelete.body?.error as { code: string }).code, "PROJECT_IN_USE");
    const taskDelete = await request(`/api/tasks/${task.id}`, { method: "DELETE" });
    assert.equal(taskDelete.response.statusCode, 204);
    const projectDeleteAfterTask = await request(`/api/projects/${project.id}`, {
      method: "DELETE",
    });
    assert.equal(projectDeleteAfterTask.response.statusCode, 204);
    const deletedTask = await request(`/api/tasks/${task.id}`);
    assert.equal(deletedTask.response.statusCode, 404);
  } finally {
    await server.close();
    repository.close();
  }
});
