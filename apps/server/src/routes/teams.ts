import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { installBundledTeam, loadBundledTeams, teamSourceTag } from "../bundled-teams.ts";
import { data, notFound } from "./app-types.ts";

const listQuery = z.object({ workspaceId: z.string().optional() });
const idParams = z.object({ id: z.string() });
const installBody = z.object({
  workspaceId: z.string().min(1),
  runtime: z.enum(["claude", "codex"]),
});

export const teamRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) => {
    const { workspaceId } = request.query;
    const isInstalled = async (teamId: string) =>
      workspaceId
        ? (await app.repository.listAgentsBySourceTeam(workspaceId, `${teamId}@`)).length > 0
        : false;
    const teams = await Promise.all(
      loadBundledTeams(app.bundledTeamsDirectory).map(async (team) => ({
        id: team.id,
        version: team.version,
        name: team.name,
        description: team.description,
        members: team.members,
        workflowGuides: team.workflowGuides,
        source: teamSourceTag(team),
        installed: await isInstalled(team.id),
      })),
    );
    return data(reply, 200, teams);
  });

  app.post(
    "/:id/install",
    { schema: { params: idParams, body: installBody } },
    async (request, reply) => {
      const team =
        loadBundledTeams(app.bundledTeamsDirectory).find((item) => item.id === request.params.id) ??
        notFound("Team", request.params.id);
      const result = await installBundledTeam(team, request.body, {
        repository: app.repository,
        skillLibrary: app.skillLibrary,
      });
      return data(reply, result.alreadyInstalled ? 200 : 201, result);
    },
  );
};
