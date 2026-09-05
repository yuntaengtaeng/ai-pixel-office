import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { parseCreateTask, parseUpdateTask, type TaskStatus } from "@ai-pixel-office/domain";
import type { Repository } from "../repository/index.ts";
import { data, notFound } from "./app-types.ts";

const idParams = z.object({ id: z.string() });
const taskStatuses = [
  "todo",
  "working",
  "needs_review",
  "needs_input",
  "blocked",
  "done",
  "failed",
] as const satisfies readonly TaskStatus[];
const listQuery = z.object({
  workspaceId: z.string().optional(),
  status: z.enum(taskStatuses).optional(),
  origin: z.enum(["office", "chat"]).optional(),
});
const workflowBody = z.object({ agentIds: z.array(z.string()) });
const feedbackBody = z.object({ feedback: z.string() });
const messageBody = z.object({ message: z.string() });

export const taskRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) =>
    data(
      reply,
      200,
      await app.repository.listTasks(
        request.query.workspaceId,
        request.query.status,
        request.query.origin,
      ),
    ),
  );

  app.post("", async (request, reply) =>
    data(reply, 201, await app.repository.createTask(parseCreateTask(request.body))),
  );

  app.put(
    "/:id/workflow",
    { schema: { params: idParams, body: workflowBody } },
    async (request, reply) =>
      data(
        reply,
        200,
        await app.repository.setTaskWorkflow(request.params.id, request.body.agentIds),
      ),
  );

  app.post("/:id/run", { schema: { params: idParams } }, async (request, reply) =>
    data(reply, 202, await app.orchestrator.startTask(request.params.id)),
  );

  app.post("/:id/retry", { schema: { params: idParams } }, async (request, reply) =>
    data(reply, 202, await app.orchestrator.retryTask(request.params.id)),
  );

  app.post("/:id/continue", { schema: { params: idParams } }, async (request, reply) =>
    data(reply, 202, await app.orchestrator.continueTask(request.params.id)),
  );

  app.post("/:id/extend-session", { schema: { params: idParams } }, async (request, reply) =>
    data(reply, 202, await app.orchestrator.extendTaskSession(request.params.id)),
  );

  app.post("/:id/approve", { schema: { params: idParams } }, async (request, reply) =>
    data(reply, 200, await app.orchestrator.approveTask(request.params.id)),
  );

  app.post("/:id/document", { schema: { params: idParams } }, async (request, reply) => {
    const task =
      (await app.repository.getTask(request.params.id)) ?? notFound("Task", request.params.id);
    const generated = await app.orchestrator.generateTaskDocument(task.id);
    return data(
      reply,
      201,
      await app.knowledgeDocuments.create({
        workspaceId: task.workspaceId,
        title: generated.title,
        content: generated.content,
        taskId: task.id,
        runId: generated.runId,
      }),
    );
  });

  app.post(
    "/:id/messages",
    { schema: { params: idParams, body: messageBody } },
    async (request, reply) =>
      data(
        reply,
        202,
        await app.orchestrator.sendChatMessage(request.params.id, request.body.message),
      ),
  );

  app.post(
    "/:id/request-changes",
    { schema: { params: idParams, body: feedbackBody } },
    async (request, reply) =>
      data(
        reply,
        202,
        await app.orchestrator.requestChanges(request.params.id, request.body.feedback),
      ),
  );

  app.get("/:id/execution-context", { schema: { params: idParams } }, async (request, reply) =>
    data(reply, 200, await app.orchestrator.getTaskExecutionContexts(request.params.id)),
  );

  app.get("/:id", { schema: { params: idParams } }, async (request, reply) => {
    const task =
      (await app.repository.getTask(request.params.id)) ?? notFound("Task", request.params.id);
    const runs = await app.repository.listRuns(request.params.id);
    const progressByRun: Record<string, Awaited<ReturnType<Repository["listRunProgress"]>>> = {};
    for (const run of runs) {
      progressByRun[run.id] = await app.repository.listRunProgress(run.id, 50);
    }
    return data(reply, 200, {
      ...task,
      runs,
      workflow: await app.repository.listWorkflowSteps(task.id),
      reviews: await app.repository.listReviews(request.params.id),
      progress: runs[0] ? await app.repository.listRunProgress(runs[0].id) : [],
      progressByRun,
    });
  });

  app.patch("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      await app.repository.updateTask(request.params.id, parseUpdateTask(request.body)),
    ),
  );

  app.delete("/:id", { schema: { params: idParams } }, async (request, reply) => {
    await app.repository.deleteTask(request.params.id);
    return reply.status(204).send();
  });
};
