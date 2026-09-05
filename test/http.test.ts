import assert from "node:assert/strict";
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

test("serves workspace, skill, agent, and task CRUD", async () => {
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
    skillDraftGenerator: async (brief) => ({
      name: "UI Review",
      category: "Design",
      description: brief,
      instructions: "## 검토\n일관성을 확인합니다.",
      tools: ["figma"],
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

    const inputResponse = await request("/api/inputs", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: workspace.id,
        type: "idea",
        content: "검색 필터를 추가하면 좋겠다",
      }),
    });
    assert.equal(inputResponse.response.statusCode, 201);
    const capturedInput = inputResponse.body?.data as { id: string; status: string };
    assert.equal(capturedInput.status, "inbox");
    const inputList = await request(`/api/inputs?workspaceId=${workspace.id}&status=inbox`);
    assert.equal((inputList.body?.data as unknown[]).length, 1);
    const convertedInput = await request(`/api/inputs/${capturedInput.id}/convert`, {
      method: "POST",
      body: JSON.stringify({ priority: "high" }),
    });
    assert.equal(convertedInput.response.statusCode, 201);
    assert.equal(
      (convertedInput.body?.data as { task: { sourceInputId: string } }).task.sourceInputId,
      capturedInput.id,
    );

    const projectResponse = await request("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: workspace.id,
        name: "Main app",
        description: "Ship the new app",
        figmaUrl: "https://figma.com/design/example",
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
      body: JSON.stringify({ status: "paused", path: process.cwd() }),
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
        workspaceId: workspace.id,
        name: "React",
        category: "Frontend",
        description: "Build React UI",
        instructions: "Use TypeScript.",
        tools: [],
        requiredPermissions: ["fileRead"],
      }),
    });
    const skill = skillResponse.body?.data as { id: string };

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

    const secondAgentResponse = await request("/api/agents", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: workspace.id,
        name: "Code Reviewer",
        role: "Review changes",
        model: "claude",
        skillIds: [],
        permissions: { fileRead: true, terminal: true },
      }),
    });
    const secondAgent = secondAgentResponse.body?.data as { id: string };

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
    assert.equal((draftResponse.body?.data as { name: string }).name, "UI Review");

    const taskResponse = await request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: workspace.id,
        title: "Build login",
        assigneeAgentId: agent.id,
        projectId: project.id,
      }),
    });
    assert.equal(taskResponse.response.statusCode, 201);
    const task = taskResponse.body?.data as { id: string; status: string; projectId: string };
    assert.equal(task.status, "todo");
    assert.equal(task.projectId, project.id);
    const workflowResponse = await request(`/api/tasks/${task.id}/workflow`, {
      method: "PUT",
      body: JSON.stringify({ agentIds: [agent.id, secondAgent.id] }),
    });
    assert.equal(workflowResponse.response.statusCode, 200);
    assert.equal((workflowResponse.body?.data as unknown[]).length, 2);

    const presetResponse = await request("/api/workflow-presets", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: workspace.id,
        name: "UI 구현 검토",
        agentIds: [agent.id, secondAgent.id],
      }),
    });
    assert.equal(presetResponse.response.statusCode, 201);
    const preset = presetResponse.body?.data as { id: string; name: string; agentIds: string[] };
    assert.equal(preset.name, "UI 구현 검토");
    assert.deepEqual(preset.agentIds, [agent.id, secondAgent.id]);
    const presetList = await request(`/api/workflow-presets?workspaceId=${workspace.id}`);
    assert.equal((presetList.body?.data as unknown[]).length, 1);

    const detail = await request(`/api/tasks/${task.id}`);
    assert.equal(detail.response.statusCode, 200);
    assert.deepEqual((detail.body?.data as { runs: unknown[] }).runs, []);
    assert.deepEqual((detail.body?.data as { progress: unknown[] }).progress, []);
    assert.equal((detail.body?.data as { workflow: unknown[] }).workflow.length, 2);
    const executionContext = await request(`/api/tasks/${task.id}/execution-context`);
    assert.equal(executionContext.response.statusCode, 200);
    const contexts = executionContext.body?.data as Array<{
      runtime: string;
      workingDirectory: string;
    }>;
    assert.deepEqual(
      contexts.map((context) => context.runtime),
      ["codex", "claude"],
    );
    assert.equal(contexts[0]?.workingDirectory, process.cwd());

    const presetDelete = await request(`/api/workflow-presets/${preset.id}`, {
      method: "DELETE",
    });
    assert.equal(presetDelete.response.statusCode, 204);

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
