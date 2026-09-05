import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { data } from "./app-types.ts";

const summaryQuery = z.object({
  workspaceId: z.string().min(1),
  period: z.enum(["week", "month", "all"]).default("all"),
});

export const performanceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/summary", { schema: { querystring: summaryQuery } }, async (request, reply) =>
    data(
      reply,
      200,
      await app.repository.getPerformanceSummary(request.query.workspaceId, request.query.period),
    ),
  );
};
