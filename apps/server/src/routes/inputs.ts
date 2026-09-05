import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import {
  DomainError,
  parseCreateInput,
  parseCreateTask,
  parseUpdateInput,
  type InputStatus,
} from "@ai-pixel-office/domain";
import { data, notFound } from "./app-types.ts";

const idParams = z.object({ id: z.string() });
const inputStatuses = ["inbox", "triaged", "converted", "archived"] as const satisfies readonly InputStatus[];
const listQuery = z.object({
  workspaceId: z.string().min(1),
  status: z.enum(inputStatuses).optional(),
});
const convertBody = z.record(z.string(), z.unknown()).optional();

export const inputRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) =>
    data(
      reply,
      200,
      await app.repository.listInputs(request.query.workspaceId, request.query.status),
    ),
  );

  app.post("", async (request, reply) =>
    data(reply, 201, await app.repository.createInput(parseCreateInput(request.body))),
  );

  app.get("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      (await app.repository.getInput(request.params.id)) ?? notFound("Input", request.params.id),
    ),
  );

  app.patch("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      await app.repository.updateInput(request.params.id, parseUpdateInput(request.body)),
    ),
  );

  app.delete("/:id", { schema: { params: idParams } }, async (request, reply) => {
    await app.repository.deleteInput(request.params.id);
    return reply.status(204).send();
  });

  app.post(
    "/:id/convert",
    { schema: { params: idParams, body: convertBody } },
    async (request, reply) => {
      const captured =
        (await app.repository.getInput(request.params.id)) ??
        notFound("Input", request.params.id);
      const body = request.body ?? {};
      if ("title" in body && typeof body.title !== "string" && body.title !== undefined) {
        throw new DomainError("INVALID_FIELD", "title must be a string");
      }
      const parsed = parseCreateTask({
        ...body,
        workspaceId: captured.workspaceId,
        title: body.title ?? captured.title ?? captured.content.slice(0, 80),
      });
      return data(reply, 201, await app.repository.convertInput(request.params.id, parsed));
    },
  );
};
