import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { parseCreateAgent, parseUpdateAgent } from "@ai-pixel-office/domain";
import { data, notFound } from "./app-types.ts";

const idParams = z.object({ id: z.string() });
const templateParams = z.object({ id: z.string(), templateId: z.string() });
const listQuery = z.object({ workspaceId: z.string().optional() });
const createTemplateBody = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export const agentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) =>
    data(reply, 200, await app.repository.listAgents(request.query.workspaceId)),
  );

  app.post("", async (request, reply) =>
    data(reply, 201, await app.repository.createAgent(parseCreateAgent(request.body))),
  );

  app.get("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      (await app.repository.getAgent(request.params.id)) ?? notFound("Agent", request.params.id),
    ),
  );

  app.patch("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      await app.repository.updateAgent(request.params.id, parseUpdateAgent(request.body)),
    ),
  );

  app.delete("/:id", { schema: { params: idParams } }, async (request, reply) => {
    await app.repository.deleteAgent(request.params.id);
    return reply.status(204).send();
  });

  app.get(
    "/:id/task-templates",
    { schema: { params: idParams } },
    async (request, reply) => data(reply, 200, await app.repository.listAgentTaskTemplates(request.params.id)),
  );

  app.post(
    "/:id/task-templates",
    { schema: { params: idParams, body: createTemplateBody } },
    async (request, reply) =>
      data(
        reply,
        201,
        await app.repository.createAgentTaskTemplate({
          agentId: request.params.id,
          title: request.body.title,
          description: request.body.description?.trim() || undefined,
          priority: request.body.priority,
        }),
      ),
  );

  app.delete(
    "/:id/task-templates/:templateId",
    { schema: { params: templateParams } },
    async (request, reply) => {
      await app.repository.deleteAgentTaskTemplate(request.params.id, request.params.templateId);
      return reply.status(204).send();
    },
  );
};
