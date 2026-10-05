import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { data } from "./app-types.ts";

const idParams = z.object({ id: z.string() });
const messageBody = z.object({ message: z.string() });
const feedbackBody = z.object({ feedback: z.string() });

/** 프로젝트 팀장 대화 (`/api/projects/:id/lead`) */
export const projectLeadRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/:id/lead", { schema: { params: idParams } }, async (request, reply) =>
    data(reply, 200, await app.orchestrator.lead.conversation(request.params.id)),
  );

  app.post(
    "/:id/lead/messages",
    { schema: { params: idParams, body: messageBody } },
    async (request, reply) =>
      data(reply, 202, await app.orchestrator.lead.send(request.params.id, request.body.message)),
  );

  app.post("/:id/lead/stop", { schema: { params: idParams } }, async (request, reply) => {
    await app.orchestrator.lead.stopReply(request.params.id);
    return reply.status(204).send();
  });
};

/** 팀장 계획서 결재·반려 (`/api/lead-plans`) */
export const leadPlanRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post("/:id/approve", { schema: { params: idParams } }, async (request, reply) =>
    data(reply, 200, await app.orchestrator.lead.approvePlan(request.params.id)),
  );

  app.post("/:id/discard", { schema: { params: idParams } }, async (request, reply) =>
    data(reply, 200, await app.orchestrator.lead.discardPlan(request.params.id)),
  );

  app.post(
    "/:id/reject",
    { schema: { params: idParams, body: feedbackBody } },
    async (request, reply) =>
      data(
        reply,
        200,
        await app.orchestrator.lead.rejectPlan(request.params.id, request.body.feedback),
      ),
  );
};
