import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { parseCreateWorkspace, parseUpdateWorkspace } from "@ai-pixel-office/domain";
import { data, notFound } from "./app-types.ts";

const idParams = z.object({ id: z.string() });

export const workspaceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", async (_request, reply) => data(reply, 200, await app.repository.listWorkspaces()));

  app.post("", async (request, reply) =>
    data(reply, 201, await app.repository.createWorkspace(parseCreateWorkspace(request.body))),
  );

  app.get("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      (await app.repository.getWorkspace(request.params.id)) ??
        notFound("Workspace", request.params.id),
    ),
  );

  app.patch("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      await app.repository.updateWorkspace(request.params.id, parseUpdateWorkspace(request.body)),
    ),
  );

  app.delete("/:id", { schema: { params: idParams } }, async (request, reply) => {
    await app.repository.deleteWorkspace(request.params.id);
    return reply.status(204).send();
  });
};
