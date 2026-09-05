import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { parseCreateSkill, parseUpdateSkill } from "@ai-pixel-office/domain";
import { generateSkillDraft } from "../skill-draft.ts";
import { data, notFound } from "./app-types.ts";

const idParams = z.object({ id: z.string() });
const listQuery = z.object({ workspaceId: z.string().optional() });
const draftBody = z.object({ brief: z.string().trim().min(1) });

export const skillRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) =>
    data(reply, 200, await app.repository.listSkills(request.query.workspaceId)),
  );

  app.post("", async (request, reply) =>
    data(reply, 201, await app.repository.createSkill(parseCreateSkill(request.body))),
  );

  app.post("/draft", { schema: { body: draftBody } }, async (request, reply) => {
    const generator =
      app.skillDraftGenerator ??
      ((brief: string) => generateSkillDraft(brief, app.generalWorkingDirectory));
    return data(reply, 200, await generator(request.body.brief));
  });

  app.get("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      (await app.repository.getSkill(request.params.id)) ?? notFound("Skill", request.params.id),
    ),
  );

  app.patch("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      await app.repository.updateSkill(request.params.id, parseUpdateSkill(request.body)),
    ),
  );

  app.delete("/:id", { schema: { params: idParams } }, async (request, reply) => {
    await app.repository.deleteSkill(request.params.id);
    return reply.status(204).send();
  });
};
