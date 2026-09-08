import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { data, notFound } from "./app-types.ts";
import { removeAttachmentFiles } from "./attachments.ts";

const query = z.object({ workspaceId: z.string().min(1) });
const resetBody = z.object({ confirmation: z.literal("AI Pixel Office 데이터 초기화") });

async function bytesAt(path: string): Promise<number> {
  const info = await stat(path).catch(() => undefined);
  if (!info) return 0;
  if (info.isFile()) return info.size;
  if (!info.isDirectory()) return 0;
  const entries = await readdir(path).catch(() => []);
  return entries.reduce(async (total, entry) => (await total) + (await bytesAt(`${path}/${entry}`)), Promise.resolve(0));
}

export const storageRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("", { schema: { querystring: query } }, async (request, reply) => {
    const workspace = await app.repository.getWorkspace(request.query.workspaceId);
    if (!workspace) notFound("Workspace", request.query.workspaceId);
    const attachments = app.repository.listAttachmentsByWorkspace(request.query.workspaceId);
    const tasks = await app.repository.listTasks(request.query.workspaceId);
    const completedIds = new Set(tasks.filter((task) => task.status === "done").map((task) => task.id));
    const attachmentBytes = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
    const pending = attachments.filter((attachment) => !attachment.runId);
    const [logsBytes, generalBytes, databaseBytes] = await Promise.all([
      bytesAt(app.runtimeLogDirectory),
      bytesAt(app.generalWorkingDirectory),
      Promise.all(app.repository.databaseFiles().map(bytesAt)).then((sizes) => sizes.reduce((a, b) => a + b, 0)),
    ]);
    return data(reply, 200, {
      totalBytes: generalBytes + databaseBytes,
      attachmentBytes,
      runtimeLogBytes: logsBytes,
      databaseBytes,
      completedTaskBytes: attachments
        .filter((attachment) => completedIds.has(attachment.taskId))
        .reduce((sum, attachment) => sum + attachment.size, 0),
      completedTaskCount: completedIds.size,
      pendingAttachmentBytes: pending.reduce((sum, attachment) => sum + attachment.size, 0),
      pendingAttachmentCount: pending.length,
    });
  });

  app.delete("/pending", { schema: { querystring: query } }, async (request, reply) => {
    const attachments = app.repository.deletePendingAttachmentsByWorkspace(request.query.workspaceId);
    await removeAttachmentFiles(app.generalWorkingDirectory, attachments.map((item) => item.storagePath));
    return data(reply, 200, { deletedCount: attachments.length });
  });

  app.delete("/completed-tasks", { schema: { querystring: query } }, async (request, reply) => {
    const tasks = await app.repository.listTasks(request.query.workspaceId, "done");
    const paths = tasks.flatMap((task) =>
      app.repository.listAttachmentsByTask(task.id).map((attachment) => attachment.storagePath),
    );
    for (const task of tasks) await app.repository.deleteTask(task.id);
    await removeAttachmentFiles(app.generalWorkingDirectory, paths);
    return data(reply, 200, { deletedCount: tasks.length });
  });

  app.post("/reset", { schema: { body: resetBody } }, async (_request, reply) => {
    const active = (await app.repository.listTasks()).some((task) =>
      ["working", "needs_input"].includes(task.status),
    );
    if (active) {
      return reply.code(409).send({
        error: { code: "ACTIVE_TASKS", message: "진행 중이거나 승인을 기다리는 작업을 먼저 종료해 주세요." },
      });
    }
    const workspaces = await app.repository.listWorkspaces();
    const attachmentPaths = workspaces.flatMap((workspace) =>
      app.repository.listAttachmentsByWorkspace(workspace.id).map((item) => item.storagePath),
    );
    app.repository.resetApplicationData();
    await removeAttachmentFiles(app.generalWorkingDirectory, attachmentPaths);
    // general과 runtime-logs는 앱이 소유한다. 사용자가 연결한 프로젝트 경로는 절대 삭제하지 않는다.
    for (const directory of new Set([app.generalWorkingDirectory, app.runtimeLogDirectory])) {
      const entries = await readdir(directory).catch(() => []);
      await Promise.all(entries.map((entry) => rm(`${directory}/${entry}`, { recursive: true, force: true }).catch(() => undefined)));
      await mkdir(directory, { recursive: true });
    }
    return data(reply, 200, { reset: true });
  });
};
