import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import {
  DomainError,
  parseCreateAgent,
  parseCreateInput,
  parseCreateSkill,
  parseCreateTask,
  parseCreateWorkspace,
  parseUpdateAgent,
  parseUpdateInput,
  parseUpdateSkill,
  parseUpdateTask,
  parseUpdateWorkspace,
  type TaskStatus,
  type InputStatus,
} from "@ai-pixel-office/domain";
import type { ApprovalDecision } from "@ai-pixel-office/runtime-protocol";
import { EventBus } from "./events.ts";
import { Orchestrator } from "./orchestrator.ts";
import { Repository } from "./repository.ts";
import { generateSkillDraft, type SkillDraft } from "./skill-draft.ts";
import { getSystemStatus } from "./system-status.ts";
import { pickDirectory } from "./directory-picker.ts";

export type AppDependencies = {
  repository: Repository;
  orchestrator: Orchestrator;
  events: EventBus;
  generalWorkingDirectory: string;
  corsOrigin?: string;
  staticRoot?: string;
  skillDraftGenerator?: (brief: string) => Promise<SkillDraft>;
};

type IdParams = { id: string };
type WorkspaceQuery = { workspaceId?: string };
type TaskQuery = WorkspaceQuery & { status?: string };
type InputQuery = WorkspaceQuery & { status?: string };
type RunIdParams = { runId: string };
type ApprovalParams = RunIdParams & { requestId: string };
type AgentTemplateParams = { id: string; templateId: string };

const decisions = new Set<ApprovalDecision>(["accept", "acceptForSession", "decline", "cancel"]);
const taskStatuses = new Set<TaskStatus>([
  "todo",
  "working",
  "needs_review",
  "needs_input",
  "blocked",
  "done",
  "failed",
]);
const inputStatuses = new Set<InputStatus>(["inbox", "triaged", "converted", "archived"]);

function data(reply: FastifyReply, status: number, value: unknown): FastifyReply {
  return reply.status(status).send({ data: value });
}

export function createHttpServer(dependencies: AppDependencies): FastifyInstance {
  const { repository, orchestrator, events } = dependencies;
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024 });

  void app.register(cors, {
    origin: dependencies.corsOrigin ?? "http://localhost:47371",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  if (dependencies.staticRoot) {
    void app.register(fastifyStatic, {
      root: resolve(dependencies.staticRoot),
      prefix: "/",
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      reply.status(error.status).send({ error: { code: error.code, message: error.message } });
      return;
    }
    const fastifyError = error as { statusCode?: number; code?: string; message?: string };
    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      const code =
        fastifyError.code === "FST_ERR_CTP_INVALID_JSON_BODY" ? "INVALID_JSON" : "BAD_REQUEST";
      reply.status(fastifyError.statusCode).send({
        error: { code, message: fastifyError.message ?? "Bad request" },
      });
      return;
    }
    console.error(error);
    reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });

  app.setNotFoundHandler((request, reply) => {
    if (dependencies.staticRoot && request.method === "GET" && !request.url.startsWith("/api/")) {
      return reply
        .type("text/html; charset=utf-8")
        .send(readFileSync(join(resolve(dependencies.staticRoot), "index.html"), "utf8"));
    }
    reply.status(404).send({
      error: { code: "NOT_FOUND", message: `Route not found: ${request.method} ${request.url}` },
    });
  });

  app.get("/health", async () => ({ status: "ok", runtimes: ["codex", "claude"] }));
  app.get("/api/system/status", async (_request, reply) =>
    data(reply, 200, await getSystemStatus()),
  );
  app.post<{ Body: unknown }>("/api/system/check-directory", async (request, reply) => {
    const body = request.body as { path?: unknown };
    if (!body || typeof body.path !== "string" || body.path.trim() === "") {
      throw new DomainError("INVALID_DIRECTORY", "확인할 프로젝트 폴더 경로를 입력해 주세요.");
    }
    const directory = resolve(body.path.trim());
    try {
      if (!statSync(directory).isDirectory()) throw new Error("not directory");
    } catch {
      throw new DomainError("INVALID_DIRECTORY", `폴더를 찾을 수 없습니다: ${directory}`, 422);
    }
    return data(reply, 200, { path: directory, valid: true });
  });
  app.post<{ Body: unknown }>("/api/system/pick-directory", async (request, reply) => {
    const body = (request.body ?? {}) as { startPath?: unknown };
    const startPath = typeof body.startPath === "string" ? body.startPath : undefined;
    const path = await pickDirectory(startPath);
    return data(reply, 200, path ? { path, cancelled: false } : { cancelled: true });
  });

  app.get<{ Querystring: WorkspaceQuery }>("/api/events", async (request, reply) => {
    const { workspaceId } = request.query;
    if (!workspaceId) throw new DomainError("WORKSPACE_REQUIRED", "workspaceId is required");
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": dependencies.corsOrigin ?? "http://localhost:47371",
    });
    const unsubscribe = events.subscribe(workspaceId, reply.raw);
    const heartbeat = setInterval(() => reply.raw.write(": heartbeat\n\n"), 15_000);
    request.raw.once("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.get("/api/workspaces", async (_request, reply) =>
    data(reply, 200, await repository.listWorkspaces()),
  );
  app.post<{ Body: unknown }>("/api/workspaces", async (request, reply) =>
    data(reply, 201, await repository.createWorkspace(parseCreateWorkspace(request.body))),
  );
  app.get<{ Params: IdParams }>("/api/workspaces/:id", async (request, reply) =>
    data(
      reply,
      200,
      (await repository.getWorkspace(request.params.id)) ??
        notFound("Workspace", request.params.id),
    ),
  );
  app.patch<{ Params: IdParams; Body: unknown }>("/api/workspaces/:id", async (request, reply) =>
    data(
      reply,
      200,
      await repository.updateWorkspace(request.params.id, parseUpdateWorkspace(request.body)),
    ),
  );
  app.delete<{ Params: IdParams }>("/api/workspaces/:id", async (request, reply) => {
    await repository.deleteWorkspace(request.params.id);
    return reply.status(204).send();
  });

  app.get<{ Querystring: WorkspaceQuery }>("/api/projects", async (request, reply) => {
    if (!request.query.workspaceId)
      throw new DomainError("WORKSPACE_REQUIRED", "workspaceId is required");
    return data(reply, 200, await repository.listProjectDirectories(request.query.workspaceId));
  });
  app.get<{ Params: IdParams }>("/api/projects/:id", async (request, reply) =>
    data(
      reply,
      200,
      (await repository.getProject(request.params.id)) ?? notFound("Project", request.params.id),
    ),
  );
  app.post<{ Body: unknown }>("/api/projects", async (request, reply) => {
    const body = request.body as {
      workspaceId?: unknown;
      name?: unknown;
      description?: unknown;
      status?: unknown;
      figmaUrl?: unknown;
      path?: unknown;
    };
    if (
      !body ||
      typeof body.workspaceId !== "string" ||
      typeof body.name !== "string" ||
      !body.name.trim()
    ) {
      throw new DomainError("INVALID_PROJECT", "프로젝트 이름을 입력해 주세요.");
    }
    if (
      body.status !== undefined &&
      body.status !== "active" &&
      body.status !== "paused" &&
      body.status !== "done"
    ) {
      throw new DomainError("INVALID_PROJECT", "프로젝트 상태가 올바르지 않습니다.");
    }
    const directory = resolveProjectDirectory(body.path);
    return data(
      reply,
      201,
      await repository.createProjectDirectory({
        workspaceId: body.workspaceId,
        name: body.name.trim(),
        ...(typeof body.description === "string" && body.description.trim()
          ? { description: body.description.trim() }
          : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(typeof body.figmaUrl === "string" && body.figmaUrl.trim()
          ? { figmaUrl: body.figmaUrl.trim() }
          : {}),
        ...(directory ? { path: directory } : {}),
      }),
    );
  });
  app.patch<{ Params: IdParams; Body: unknown }>("/api/projects/:id", async (request, reply) => {
    const body = (request.body ?? {}) as {
      name?: unknown;
      description?: unknown;
      status?: unknown;
      figmaUrl?: unknown;
      path?: unknown;
    };
    if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
      throw new DomainError("INVALID_PROJECT", "프로젝트 이름을 입력해 주세요.");
    }
    if (
      body.status !== undefined &&
      body.status !== "active" &&
      body.status !== "paused" &&
      body.status !== "done"
    ) {
      throw new DomainError("INVALID_PROJECT", "프로젝트 상태가 올바르지 않습니다.");
    }
    const directory = body.path === undefined ? undefined : resolveProjectDirectory(body.path);
    return data(
      reply,
      200,
      await repository.updateProject(request.params.id, {
        ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
        ...(typeof body.description === "string"
          ? { description: body.description.trim() || undefined }
          : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(typeof body.figmaUrl === "string"
          ? { figmaUrl: body.figmaUrl.trim() || undefined }
          : {}),
        ...(body.path !== undefined ? { path: directory } : {}),
      }),
    );
  });
  app.delete<{ Params: IdParams }>("/api/projects/:id", async (request, reply) => {
    await repository.deleteProjectDirectory(request.params.id);
    return reply.status(204).send();
  });

  app.get<{ Querystring: WorkspaceQuery }>("/api/skills", async (request, reply) =>
    data(reply, 200, await repository.listSkills(request.query.workspaceId)),
  );
  app.post<{ Body: unknown }>("/api/skills", async (request, reply) =>
    data(reply, 201, await repository.createSkill(parseCreateSkill(request.body))),
  );
  app.post<{ Body: unknown }>("/api/skills/draft", async (request, reply) => {
    const body = request.body as { brief?: unknown };
    if (!body || typeof body.brief !== "string" || body.brief.trim() === "") {
      throw new DomainError("INVALID_BRIEF", "만들고 싶은 스킬을 한 문장 이상 입력해 주세요.");
    }
    const generator =
      dependencies.skillDraftGenerator ??
      ((brief: string) => generateSkillDraft(brief, dependencies.generalWorkingDirectory));
    return data(reply, 200, await generator(body.brief.trim()));
  });
  app.get<{ Params: IdParams }>("/api/skills/:id", async (request, reply) =>
    data(
      reply,
      200,
      (await repository.getSkill(request.params.id)) ?? notFound("Skill", request.params.id),
    ),
  );
  app.patch<{ Params: IdParams; Body: unknown }>("/api/skills/:id", async (request, reply) =>
    data(
      reply,
      200,
      await repository.updateSkill(request.params.id, parseUpdateSkill(request.body)),
    ),
  );
  app.delete<{ Params: IdParams }>("/api/skills/:id", async (request, reply) => {
    await repository.deleteSkill(request.params.id);
    return reply.status(204).send();
  });

  app.get<{ Querystring: WorkspaceQuery }>("/api/agents", async (request, reply) =>
    data(reply, 200, await repository.listAgents(request.query.workspaceId)),
  );
  app.post<{ Body: unknown }>("/api/agents", async (request, reply) =>
    data(reply, 201, await repository.createAgent(parseCreateAgent(request.body))),
  );
  app.get<{ Params: IdParams }>("/api/agents/:id", async (request, reply) =>
    data(
      reply,
      200,
      (await repository.getAgent(request.params.id)) ?? notFound("Agent", request.params.id),
    ),
  );
  app.patch<{ Params: IdParams; Body: unknown }>("/api/agents/:id", async (request, reply) =>
    data(
      reply,
      200,
      await repository.updateAgent(request.params.id, parseUpdateAgent(request.body)),
    ),
  );
  app.delete<{ Params: IdParams }>("/api/agents/:id", async (request, reply) => {
    await repository.deleteAgent(request.params.id);
    return reply.status(204).send();
  });
  app.get<{ Params: IdParams }>("/api/agents/:id/task-templates", async (request, reply) =>
    data(reply, 200, await repository.listAgentTaskTemplates(request.params.id)),
  );
  app.post<{ Params: IdParams; Body: unknown }>(
    "/api/agents/:id/task-templates",
    async (request, reply) => {
      const body = request.body as { title?: unknown; description?: unknown; priority?: unknown };
      if (!body || typeof body.title !== "string" || body.title.trim() === "") {
        throw new DomainError("INVALID_TEMPLATE", "자주 맡기는 작업의 제목을 입력해 주세요.");
      }
      if (body.description !== undefined && typeof body.description !== "string") {
        throw new DomainError("INVALID_TEMPLATE", "description must be a string");
      }
      if (
        body.priority !== undefined &&
        !["low", "medium", "high"].includes(String(body.priority))
      ) {
        throw new DomainError("INVALID_TEMPLATE", "Unknown priority");
      }
      return data(
        reply,
        201,
        await repository.createAgentTaskTemplate({
          agentId: request.params.id,
          title: body.title.trim(),
          description:
            typeof body.description === "string" ? body.description.trim() || undefined : undefined,
          priority: body.priority as "low" | "medium" | "high" | undefined,
        }),
      );
    },
  );
  app.delete<{ Params: AgentTemplateParams }>(
    "/api/agents/:id/task-templates/:templateId",
    async (request, reply) => {
      await repository.deleteAgentTaskTemplate(request.params.id, request.params.templateId);
      return reply.status(204).send();
    },
  );

  app.get<{ Querystring: InputQuery }>("/api/inputs", async (request, reply) => {
    const { workspaceId, status } = request.query;
    if (!workspaceId) throw new DomainError("WORKSPACE_REQUIRED", "workspaceId is required");
    if (status && !inputStatuses.has(status as InputStatus)) {
      throw new DomainError("INVALID_STATUS", `Unknown input status: ${status}`);
    }
    return data(
      reply,
      200,
      await repository.listInputs(workspaceId, status as InputStatus | undefined),
    );
  });
  app.post<{ Body: unknown }>("/api/inputs", async (request, reply) =>
    data(reply, 201, await repository.createInput(parseCreateInput(request.body))),
  );
  app.get<{ Params: IdParams }>("/api/inputs/:id", async (request, reply) =>
    data(
      reply,
      200,
      (await repository.getInput(request.params.id)) ?? notFound("Input", request.params.id),
    ),
  );
  app.patch<{ Params: IdParams; Body: unknown }>("/api/inputs/:id", async (request, reply) =>
    data(
      reply,
      200,
      await repository.updateInput(request.params.id, parseUpdateInput(request.body)),
    ),
  );
  app.delete<{ Params: IdParams }>("/api/inputs/:id", async (request, reply) => {
    await repository.deleteInput(request.params.id);
    return reply.status(204).send();
  });
  app.post<{ Params: IdParams; Body: unknown }>(
    "/api/inputs/:id/convert",
    async (request, reply) => {
      const captured =
        (await repository.getInput(request.params.id)) ?? notFound("Input", request.params.id);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const parsed = parseCreateTask({
        ...body,
        workspaceId: captured.workspaceId,
        title: body.title ?? captured.title ?? captured.content.slice(0, 80),
      });
      return data(reply, 201, await repository.convertInput(request.params.id, parsed));
    },
  );

  app.get<{ Querystring: TaskQuery }>("/api/tasks", async (request, reply) => {
    const rawStatus = request.query.status;
    if (rawStatus && !taskStatuses.has(rawStatus as TaskStatus)) {
      throw new DomainError("INVALID_STATUS", `Unknown task status: ${rawStatus}`);
    }
    return data(
      reply,
      200,
      await repository.listTasks(request.query.workspaceId, rawStatus as TaskStatus | undefined),
    );
  });
  app.post<{ Body: unknown }>("/api/tasks", async (request, reply) =>
    data(reply, 201, await repository.createTask(parseCreateTask(request.body))),
  );
  app.get<{ Querystring: WorkspaceQuery }>("/api/workflow-presets", async (request, reply) => {
    if (!request.query.workspaceId) {
      throw new DomainError("WORKSPACE_REQUIRED", "workspaceId is required");
    }
    return data(reply, 200, await repository.listWorkflowPresets(request.query.workspaceId));
  });
  app.post<{ Body: unknown }>("/api/workflow-presets", async (request, reply) => {
    const body = request.body as {
      workspaceId?: unknown;
      name?: unknown;
      agentIds?: unknown;
    };
    if (
      !body ||
      typeof body.workspaceId !== "string" ||
      typeof body.name !== "string" ||
      !Array.isArray(body.agentIds) ||
      body.agentIds.some((id) => typeof id !== "string")
    ) {
      throw new DomainError(
        "INVALID_WORKFLOW_PRESET",
        "workspaceId, name, agentIds를 올바르게 입력해 주세요.",
      );
    }
    return data(
      reply,
      201,
      await repository.createWorkflowPreset({
        workspaceId: body.workspaceId,
        name: body.name,
        agentIds: body.agentIds as string[],
      }),
    );
  });
  app.delete<{ Params: IdParams }>("/api/workflow-presets/:id", async (request, reply) => {
    await repository.deleteWorkflowPreset(request.params.id);
    return reply.status(204).send();
  });
  app.put<{ Params: IdParams; Body: unknown }>(
    "/api/tasks/:id/workflow",
    async (request, reply) => {
      const body = request.body as { agentIds?: unknown };
      if (
        !body ||
        !Array.isArray(body.agentIds) ||
        body.agentIds.some((id) => typeof id !== "string")
      ) {
        throw new DomainError("INVALID_WORKFLOW", "agentIds must be an array of strings");
      }
      return data(
        reply,
        200,
        await repository.setTaskWorkflow(request.params.id, body.agentIds as string[]),
      );
    },
  );
  app.post<{ Params: IdParams }>("/api/tasks/:id/run", async (request, reply) =>
    data(reply, 202, await orchestrator.startTask(request.params.id)),
  );
  app.post<{ Params: IdParams }>("/api/tasks/:id/retry", async (request, reply) =>
    data(reply, 202, await orchestrator.retryTask(request.params.id)),
  );
  app.post<{ Params: IdParams }>("/api/tasks/:id/continue", async (request, reply) =>
    data(reply, 202, await orchestrator.continueTask(request.params.id)),
  );
  app.post<{ Params: IdParams }>("/api/tasks/:id/extend-session", async (request, reply) =>
    data(reply, 202, await orchestrator.extendTaskSession(request.params.id)),
  );
  app.post<{ Params: IdParams }>("/api/tasks/:id/approve", async (request, reply) =>
    data(reply, 200, await orchestrator.approveTask(request.params.id)),
  );
  app.post<{ Params: IdParams; Body: unknown }>(
    "/api/tasks/:id/request-changes",
    async (request, reply) => {
      const body = request.body as { feedback?: unknown };
      if (!body || typeof body.feedback !== "string") {
        throw new DomainError("INVALID_FEEDBACK", "feedback must be a string");
      }
      return data(reply, 202, await orchestrator.requestChanges(request.params.id, body.feedback));
    },
  );
  app.get<{ Params: IdParams }>("/api/tasks/:id/execution-context", async (request, reply) =>
    data(reply, 200, await orchestrator.getTaskExecutionContexts(request.params.id)),
  );
  app.get<{ Params: IdParams }>("/api/tasks/:id", async (request, reply) => {
    const task =
      (await repository.getTask(request.params.id)) ?? notFound("Task", request.params.id);
    const runs = await repository.listRuns(request.params.id);
    const progressByRun: Record<string, Awaited<ReturnType<Repository["listRunProgress"]>>> = {};
    for (const run of runs) {
      progressByRun[run.id] = await repository.listRunProgress(run.id, 50);
    }
    return data(reply, 200, {
      ...task,
      runs,
      workflow: await repository.listWorkflowSteps(task.id),
      reviews: await repository.listReviews(request.params.id),
      progress: runs[0] ? await repository.listRunProgress(runs[0].id) : [],
      progressByRun,
    });
  });
  app.patch<{ Params: IdParams; Body: unknown }>("/api/tasks/:id", async (request, reply) =>
    data(reply, 200, await repository.updateTask(request.params.id, parseUpdateTask(request.body))),
  );
  app.delete<{ Params: IdParams }>("/api/tasks/:id", async (request, reply) => {
    await repository.deleteTask(request.params.id);
    return reply.status(204).send();
  });

  app.get<{ Querystring: { taskId?: string } }>("/api/runs", async (request, reply) =>
    data(reply, 200, await repository.listRuns(request.query.taskId)),
  );
  app.get<{ Params: IdParams }>("/api/runs/:id", async (request, reply) =>
    data(
      reply,
      200,
      (await repository.getRun(request.params.id)) ?? notFound("AgentRun", request.params.id),
    ),
  );
  app.post<{ Params: RunIdParams }>("/api/runs/:runId/cancel", async (request, reply) =>
    data(reply, 202, await orchestrator.cancelRun(request.params.runId)),
  );
  app.post<{ Params: ApprovalParams; Body: unknown }>(
    "/api/runs/:runId/approvals/:requestId",
    async (request, reply) => {
      const body = request.body as { decision?: unknown };
      if (!body || !decisions.has(body.decision as ApprovalDecision)) {
        throw new DomainError("INVALID_DECISION", "Unknown approval decision");
      }
      return data(
        reply,
        200,
        await orchestrator.resolveApproval(
          request.params.runId,
          request.params.requestId,
          body.decision as ApprovalDecision,
        ),
      );
    },
  );

  app.get<{ Querystring: WorkspaceQuery & { limit?: string } }>(
    "/api/activities",
    async (request, reply) => {
      const { workspaceId } = request.query;
      if (!workspaceId) throw new DomainError("WORKSPACE_REQUIRED", "workspaceId is required");
      const parsedLimit = Number(request.query.limit ?? 100);
      return data(
        reply,
        200,
        await repository.listActivities(
          workspaceId,
          Number.isFinite(parsedLimit) ? parsedLimit : 100,
        ),
      );
    },
  );

  return app;
}

function notFound(entity: string, id: string): never {
  throw new DomainError("NOT_FOUND", `${entity} not found: ${id}`, 404);
}

function resolveProjectDirectory(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") {
    throw new DomainError("INVALID_PROJECT", "프로젝트 폴더 경로가 올바르지 않습니다.");
  }
  const path = value.trim();
  if (!isAbsolute(path)) {
    throw new DomainError("INVALID_DIRECTORY", "프로젝트 폴더는 절대 경로로 입력해 주세요", 422);
  }
  const directory = resolve(path);
  try {
    if (!statSync(directory).isDirectory()) throw new Error("not directory");
  } catch {
    throw new DomainError("INVALID_DIRECTORY", `폴더를 찾을 수 없습니다: ${directory}`, 422);
  }
  return directory;
}
