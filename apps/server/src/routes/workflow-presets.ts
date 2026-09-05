import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { data } from "./app-types.ts";

const idParams = z.object({ id: z.string() });
const listQuery = z.object({ workspaceId: z.string().min(1) });
const createBody = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  agentIds: z.array(z.string()),
});

export const workflowPresetRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) =>
    data(reply, 200, await app.repository.listWorkflowPresets(request.query.workspaceId)),
  );

  app.post("", { schema: { body: createBody } }, async (request, reply) =>
    data(reply, 201, await app.repository.createWorkflowPreset(request.body)),
  );

  app.delete("/:id", { schema: { params: idParams } }, async (request, reply) => {
    await app.repository.deleteWorkflowPreset(request.params.id);
    return reply.status(204).send();
  });
};
