import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import Fastify, { type FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DomainError } from "@ai-pixel-office/domain";
import { EventBus } from "./events.ts";
import { Orchestrator } from "./orchestrator.ts";
import { Repository } from "./repository/index.ts";
import { KnowledgeDocumentStore } from "./knowledge-documents.ts";
import type { SkillDraft } from "./skill-draft.ts";
import { activityRoutes } from "./routes/activities.ts";
import { agentRoutes } from "./routes/agents.ts";
import "./routes/app-types.ts";
import { inputRoutes } from "./routes/inputs.ts";
import { projectRoutes } from "./routes/projects.ts";
import { runRoutes } from "./routes/runs.ts";
import { skillRoutes } from "./routes/skills.ts";
import { systemRoutes } from "./routes/system.ts";
import { taskRoutes } from "./routes/tasks.ts";
import { workflowPresetRoutes } from "./routes/workflow-presets.ts";
import { workspaceRoutes } from "./routes/workspaces.ts";
import { knowledgeDocumentRoutes } from "./routes/knowledge-documents.ts";

export type AppDependencies = {
  repository: Repository;
  orchestrator: Orchestrator;
  events: EventBus;
  generalWorkingDirectory: string;
  knowledgeDocuments?: KnowledgeDocumentStore;
  corsOrigin?: string;
  staticRoot?: string;
  skillDraftGenerator?: (brief: string) => Promise<SkillDraft>;
};

export function createHttpServer(dependencies: AppDependencies): FastifyInstance {
  // logger: false makes request.log a no-op logger (Fastify swaps in an abstract no-op
  // instance), so the error handler's request.log.error(error) call below would silently
  // print nothing. level: "error" keeps per-request access logs off while still emitting our
  // own .error() calls.
  const app = Fastify({ logger: { level: "error" }, bodyLimit: 1024 * 1024 });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const corsOrigin = dependencies.corsOrigin ?? "http://localhost:47371";
  app.decorate("repository", dependencies.repository);
  app.decorate("orchestrator", dependencies.orchestrator);
  app.decorate("events", dependencies.events);
  app.decorate("generalWorkingDirectory", dependencies.generalWorkingDirectory);
  app.decorate(
    "knowledgeDocuments",
    dependencies.knowledgeDocuments ??
      new KnowledgeDocumentStore(dependencies.generalWorkingDirectory),
  );
  app.decorate("corsOrigin", corsOrigin);
  if (dependencies.skillDraftGenerator) {
    app.decorate("skillDraftGenerator", dependencies.skillDraftGenerator);
  }

  void app.register(cors, {
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  if (dependencies.staticRoot) {
    void app.register(fastifyStatic, {
      root: resolve(dependencies.staticRoot),
      prefix: "/",
    });
  }

  app.setErrorHandler((error, request, reply) => {
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
    request.log.error(error);
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

  void app.register(systemRoutes);
  void app.register(workspaceRoutes, { prefix: "/api/workspaces" });
  void app.register(projectRoutes, { prefix: "/api/projects" });
  void app.register(skillRoutes, { prefix: "/api/skills" });
  void app.register(agentRoutes, { prefix: "/api/agents" });
  void app.register(inputRoutes, { prefix: "/api/inputs" });
  void app.register(taskRoutes, { prefix: "/api/tasks" });
  void app.register(workflowPresetRoutes, { prefix: "/api/workflow-presets" });
  void app.register(runRoutes, { prefix: "/api/runs" });
  void app.register(activityRoutes, { prefix: "/api/activities" });
  void app.register(knowledgeDocumentRoutes, { prefix: "/api/knowledge-documents" });

  return app;
}
