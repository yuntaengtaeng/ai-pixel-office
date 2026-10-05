import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { DomainError, parseCreateSkill } from "@ai-pixel-office/domain";
import { generateSkillDraft } from "../skill-draft.ts";
import { data, notFound } from "./app-types.ts";

const idParams = z.object({ id: z.string() });
const draftBody = z.object({ brief: z.string().trim().min(1) });

export const skillRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", async (_request, reply) => data(reply, 200, app.skillLibrary.list()));

  app.post("", async (request, reply) =>
    data(reply, 201, app.skillLibrary.create(parseCreateSkill(request.body))),
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
      app.skillLibrary.get(request.params.id) ?? notFound("Skill", request.params.id),
    ),
  );

  app.delete("/:id", { schema: { params: idParams } }, async (request, reply) => {
    if (app.repository.countAgentsUsingSkill(request.params.id) > 0) {
      throw new DomainError(
        "SKILL_IN_USE",
        "이 스킬을 사용하는 동료가 있어요. 동료 설정에서 스킬 연결을 먼저 해제해 주세요.",
        409,
      );
    }
    app.skillLibrary.remove(request.params.id);
    return reply.status(204).send();
  });
};
