import { statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { DomainError } from "@ai-pixel-office/domain";
import { data, notFound } from "./app-types.ts";

const idParams = z.object({ id: z.string() });
const listQuery = z.object({ workspaceId: z.string().min(1) });
const projectStatus = z.enum(["active", "paused", "done"]);

const createBody = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  status: projectStatus.optional(),
  figmaUrl: z.string().optional(),
  path: z.string().optional(),
});

const updateBody = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  status: projectStatus.optional(),
  figmaUrl: z.string().optional(),
  path: z.string().optional(),
});

function resolveProjectDirectory(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!isAbsolute(value)) {
    throw new DomainError("INVALID_DIRECTORY", "프로젝트 폴더는 절대 경로로 입력해 주세요", 422);
  }
  const directory = resolve(value);
  try {
    if (!statSync(directory).isDirectory()) throw new Error("not directory");
  } catch {
    throw new DomainError("INVALID_DIRECTORY", `폴더를 찾을 수 없습니다: ${directory}`, 422);
  }
  return directory;
}

export const projectRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: listQuery } }, async (request, reply) =>
    data(reply, 200, await app.repository.listProjectDirectories(request.query.workspaceId)),
  );

  app.get("/:id", { schema: { params: idParams } }, async (request, reply) =>
    data(
      reply,
      200,
      (await app.repository.getProject(request.params.id)) ??
        notFound("Project", request.params.id),
    ),
  );

  app.post("", { schema: { body: createBody } }, async (request, reply) => {
    const body = request.body;
    const directory = resolveProjectDirectory(body.path);
    return data(
      reply,
      201,
      await app.repository.createProjectDirectory({
        workspaceId: body.workspaceId,
        name: body.name,
        ...(body.description?.trim() ? { description: body.description.trim() } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.figmaUrl?.trim() ? { figmaUrl: body.figmaUrl.trim() } : {}),
        ...(directory ? { path: directory } : {}),
      }),
    );
  });

  app.patch(
    "/:id",
    { schema: { params: idParams, body: updateBody } },
    async (request, reply) => {
      const body = request.body;
      const directory = body.path === undefined ? undefined : resolveProjectDirectory(body.path);
      return data(
        reply,
        200,
        await app.repository.updateProject(request.params.id, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined
            ? { description: body.description.trim() || undefined }
            : {}),
          ...(body.status ? { status: body.status } : {}),
          ...(body.figmaUrl !== undefined ? { figmaUrl: body.figmaUrl.trim() || undefined } : {}),
          ...(body.path !== undefined ? { path: directory } : {}),
        }),
      );
    },
  );

  app.delete("/:id", { schema: { params: idParams } }, async (request, reply) => {
    await app.repository.deleteProjectDirectory(request.params.id);
    return reply.status(204).send();
  });
};
