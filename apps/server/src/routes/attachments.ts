import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { resolve, relative, basename, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { data } from "./app-types.ts";

const uploadBody = z.object({
  workspaceId: z.string().min(1), taskId: z.string().min(1),
  name: z.string().min(1).max(255), mediaType: z.string().min(1).max(120),
  source: z.enum(["file", "clipboard-image"]), data: z.string().min(1),
});
const params = z.object({ id: z.string().min(1) });
// base64는 원본보다 ~33% 커지고 나머지 필드는 무시할 수 있는 크기라, 아래 25MB 원본 상한을
// 실제로 통과시키려면 전역 bodyLimit(1MB, http.ts)과 별도로 이 라우트만 더 크게 열어야 한다.
const UPLOAD_BODY_LIMIT_BYTES = 34 * 1024 * 1024;
const VISION_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

function matchesImageSignature(mediaType: string, bytes: Buffer): boolean {
  if (mediaType === "image/png")
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mediaType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mediaType === "image/gif") {
    const signature = bytes.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (mediaType === "image/webp")
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  return true;
}

function containedPath(root: string, ...parts: string[]): string {
  const target = resolve(root, ...parts);
  const relation = relative(resolve(root), target);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("Attachment path escaped its storage root");
  }
  return target;
}

export async function removeAttachmentFiles(root: string, paths: string[]): Promise<void> {
  const attachmentRoot = resolve(root, "attachments");
  await Promise.all(
    paths.map(async (path) => {
      const target = resolve(path);
      const relation = relative(attachmentRoot, target);
      if (relation.startsWith("..") || isAbsolute(relation)) return;
      await unlink(target).catch(() => undefined);
    }),
  );
}

export const attachmentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "",
    { schema: { body: uploadBody }, bodyLimit: UPLOAD_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const stale = app.repository.deletePendingAttachmentsBefore(staleBefore);
      await removeAttachmentFiles(
        app.generalWorkingDirectory,
        stale.map((attachment) => attachment.storagePath),
      );
      const input = request.body;
      const task = await app.repository.getTask(input.taskId);
      if (!task || task.workspaceId !== input.workspaceId) {
        return reply.code(404).send({
          error: { code: "TASK_NOT_FOUND", message: "첨부할 작업을 찾을 수 없습니다" },
        });
      }
      const id = randomUUID();
      const safeName = basename(input.name).replace(/[^\w. -]/g, "_");
      // 프로젝트 폴더를 오염시키지 않으면서 이력에서 다시 다운로드할 수 있도록 앱 전용 저장소를 사용한다.
      const attachmentRoot = resolve(app.generalWorkingDirectory, "attachments");
      const directory = containedPath(attachmentRoot, task.workspaceId, task.id, "pending");
      await mkdir(directory, { recursive: true });
      const path = containedPath(directory, `${id}-${safeName}`);
      // 업로드 계약은 JSON base64를 사용하지만, 저장 직전에 크기를 검사해 메모리·디스크 상한을 지킨다.
      const bytes = Buffer.from(input.data, "base64");
      if (bytes.byteLength > 25 * 1024 * 1024) return reply.code(413).send({ error: { code: "ATTACHMENT_TOO_LARGE", message: "첨부 파일은 25MB 이하만 지원해요." } });
      const normalizedMediaType = input.mediaType.toLowerCase();
      if (
        VISION_MEDIA_TYPES.has(normalizedMediaType) &&
        !matchesImageSignature(normalizedMediaType, bytes)
      ) {
        return reply.code(415).send({
          error: { code: "INVALID_IMAGE", message: "이미지 형식과 실제 파일 내용이 일치하지 않습니다" },
        });
      }
      await writeFile(path, bytes, { flag: "wx" });
      const createdAt = new Date().toISOString();
      try {
        app.repository.createAttachment({ id, workspaceId: task.workspaceId, taskId: task.id, name: input.name, mediaType: normalizedMediaType, size: bytes.byteLength, source: input.source, storagePath: path, createdAt });
      } catch (error) {
        await unlink(path).catch(() => undefined);
        throw error;
      }
      return data(reply, 201, { id, name: input.name, mediaType: input.mediaType, size: bytes.byteLength, source: input.source, createdAt });
    },
  );
  app.get("/:id/download", { schema: { params } }, async (request, reply) => {
    const attachment = app.repository.getAttachment(request.params.id);
    if (!attachment) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "첨부 파일을 찾을 수 없어요." } });
    const bytes = await readFile(attachment.storagePath);
    return reply.type(attachment.mediaType).header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`).send(bytes);
  });
  app.delete("/:id", { schema: { params } }, async (request, reply) => {
    const attachment = app.repository.deletePendingAttachment(request.params.id);
    if (!attachment) {
      return reply.code(404).send({
        error: { code: "NOT_FOUND", message: "정리할 첨부 파일을 찾을 수 없습니다" },
      });
    }
    await removeAttachmentFiles(app.generalWorkingDirectory, [attachment.storagePath]);
    return reply.status(204).send();
  });
};
