import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { ApprovalDecision } from "@ai-pixel-office/runtime-protocol";
import { data, notFound } from "./app-types.ts";

const idParams = z.object({ id: z.string() });
const runIdParams = z.object({ runId: z.string() });
const approvalParams = z.object({ runId: z.string(), requestId: z.string() });
const listQuery = z.object({ taskId: z.string().optional() });
const decisions = [
  "accept",
  "acceptForSession",
  "decline",
  "cancel",
] as const satisfies readonly ApprovalDecision[];
const approvalBody = z.object({ decision: z.enum(decisions) });

export const runRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) =>
    data(reply, 200, await app.repository.listRuns(request.query.taskId)),
  );

  app.get("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      (await app.repository.getRun(request.params.id)) ?? notFound("AgentRun", request.params.id),
    ),
  );

  app.post(
    "/:runId/cancel",
    { schema: { params: runIdParams } },
    async (request, reply) => data(reply, 202, await app.orchestrator.cancelRun(request.params.runId)),
  );

  app.post(
    "/:runId/approvals/:requestId",
    { schema: { params: approvalParams, body: approvalBody } },
    async (request, reply) =>
      data(
        reply,
        200,
        await app.orchestrator.resolveApproval(
          request.params.runId,
          request.params.requestId,
          request.body.decision,
        ),
      ),
  );
};
