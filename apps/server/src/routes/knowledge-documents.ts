import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { data, notFound } from "./app-types.ts";

const listQuery = z.object({ workspaceId: z.string().min(1) });
const idParams = z.object({ id: z.string().uuid() });
const documentBody = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1),
  content: z.string(),
  taskId: z.string().optional(),
  runId: z.string().optional(),
  referenceTaskIds: z.array(z.string()).optional(),
});
const updateBody = documentBody.omit({ workspaceId: true }).partial();
const importBody = z.object({
  workspaceId: z.string().min(1),
  fileName: z.string().trim().min(1),
  content: z.string(),
});

export const knowledgeDocumentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) => {
    if (!(await app.repository.getWorkspace(request.query.workspaceId))) {
      notFound("Workspace", request.query.workspaceId);
    }
    return data(reply, 200, await app.knowledgeDocuments.list(request.query.workspaceId));
  });

  app.post("", { schema: { body: documentBody } }, async (request, reply) => {
    if (!(await app.repository.getWorkspace(request.body.workspaceId))) {
      notFound("Workspace", request.body.workspaceId);
    }
    return data(reply, 201, await app.knowledgeDocuments.create(request.body));
  });

  app.post("/import", { schema: { body: importBody } }, async (request, reply) => {
    if (!(await app.repository.getWorkspace(request.body.workspaceId))) {
      notFound("Workspace", request.body.workspaceId);
    }
    return data(
      reply,
      201,
      await app.knowledgeDocuments.import(
        request.body.workspaceId,
        request.body.fileName,
        request.body.content,
      ),
    );
  });

  app.patch(
    "/:id",
    { schema: { params: idParams, querystring: listQuery, body: updateBody } },
    async (request, reply) =>
      data(
        reply,
        200,
        await app.knowledgeDocuments.update(
          request.query.workspaceId,
          request.params.id,
          request.body,
        ),
      ),
  );

  app.delete(
    "/:id",
    { schema: { params: idParams, querystring: listQuery } },
    async (request, reply) => {
      await app.knowledgeDocuments.remove(request.query.workspaceId, request.params.id);
      return reply.status(204).send();
    },
  );
};
