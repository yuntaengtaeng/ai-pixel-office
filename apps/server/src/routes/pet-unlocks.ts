import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { data } from "./app-types.ts";

const progressQuery = z.object({
  workspaceId: z.string().min(1),
});

export const petUnlockRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: progressQuery } }, async (request, reply) =>
    data(reply, 200, await app.repository.getPetUnlockProgress(request.query.workspaceId)),
  );
  app.post("/evaluate", { schema: { body: progressQuery } }, async (request, reply) =>
    data(reply, 200, await app.repository.evaluatePetUnlocks(request.body.workspaceId)),
  );
};
