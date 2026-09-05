import type { FastifyReply } from "fastify";
import { DomainError } from "@ai-pixel-office/domain";
import type { EventBus } from "../events.ts";
import type { Orchestrator } from "../orchestrator.ts";
import type { Repository } from "../repository/index.ts";
import type { SkillDraft } from "../skill-draft.ts";

declare module "fastify" {
  interface FastifyInstance {
    repository: Repository;
    orchestrator: Orchestrator;
    events: EventBus;
    generalWorkingDirectory: string;
    corsOrigin: string;
    skillDraftGenerator?: (brief: string) => Promise<SkillDraft>;
  }
}

export function data(reply: FastifyReply, status: number, value: unknown): FastifyReply {
  return reply.status(status).send({ data: value });
}

export function notFound(entity: string, id: string): never {
  throw new DomainError("NOT_FOUND", `${entity} not found: ${id}`, 404);
}
