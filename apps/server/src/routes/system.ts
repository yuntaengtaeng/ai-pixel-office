import { statSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { DomainError } from "@ai-pixel-office/domain";
import { pickDirectory } from "../directory-picker.ts";
import { getSystemStatus } from "../system-status.ts";
import { data } from "./app-types.ts";

const checkDirectoryBody = z.object({ path: z.string().trim().min(1) });
const pickDirectoryBody = z.object({ startPath: z.string().optional() }).optional();
const eventsQuery = z.object({ workspaceId: z.string().min(1) });

export const systemRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/health", async () => ({ status: "ok", runtimes: ["codex", "claude"] }));

  app.get("/api/system/status", async (_request, reply) =>
    data(reply, 200, await getSystemStatus()),
  );

  app.post(
    "/api/system/check-directory",
    { schema: { body: checkDirectoryBody } },
    async (request, reply) => {
      const directory = resolve(request.body.path);
      try {
        if (!statSync(directory).isDirectory()) throw new Error("not directory");
      } catch {
        throw new DomainError("INVALID_DIRECTORY", `폴더를 찾을 수 없습니다: ${directory}`, 422);
      }
      return data(reply, 200, { path: directory, valid: true });
    },
  );

  app.post(
    "/api/system/pick-directory",
    { schema: { body: pickDirectoryBody } },
    async (request, reply) => {
      const path = await pickDirectory(request.body?.startPath);
      return data(reply, 200, path ? { path, cancelled: false } : { cancelled: true });
    },
  );

  app.get(
    "/api/events",
    { schema: { querystring: eventsQuery } },
    async (request, reply) => {
      const { workspaceId } = request.query;
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": app.corsOrigin,
      });
      const unsubscribe = app.events.subscribe(workspaceId, reply.raw);
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(": heartbeat\n\n");
        } catch {
          // socket already broken; the close/error handlers below finish teardown
        }
      }, 15_000);
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.raw.once("close", cleanup);
      reply.raw.once("error", cleanup);
    },
  );
};
