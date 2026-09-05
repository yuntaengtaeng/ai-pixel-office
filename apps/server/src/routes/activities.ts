import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { data } from "./app-types.ts";

const listQuery = z.object({
  workspaceId: z.string().min(1),
  limit: z.coerce.number().finite().optional(),
});

export const activityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) =>
    data(
      reply,
      200,
      await app.repository.listActivities(request.query.workspaceId, request.query.limit ?? 100),
    ),
  );
};
