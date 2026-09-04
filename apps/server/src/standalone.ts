import { startServer } from "./index.ts";

type ParentMessage = { type: "shutdown" };

async function main(): Promise<void> {
  const port = Number(process.env.PIXEL_OFFICE_SERVER_PORT ?? process.env.PORT ?? "47372");
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid PIXEL_OFFICE_SERVER_PORT: ${process.env.PIXEL_OFFICE_SERVER_PORT}`);
  }

  const runtime = await startServer({
    port,
    host: process.env.PIXEL_OFFICE_SERVER_HOST ?? process.env.HOST ?? "127.0.0.1",
    databasePath: process.env.PIXEL_OFFICE_DATABASE_PATH,
    staticRoot: process.env.PIXEL_OFFICE_STATIC_ROOT,
    generalWorkingDirectory: process.env.PIXEL_OFFICE_GENERAL_WORKING_DIRECTORY,
  });
  process.send?.({ type: "ready", address: runtime.address });

  let stopping = false;
  async function shutdown(): Promise<void> {
    if (stopping) return;
    stopping = true;
    await runtime.server.close();
    process.exit(0);
  }

  process.on("message", (message: ParentMessage) => {
    if (message?.type === "shutdown") void shutdown();
  });
  process.on("disconnect", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main().catch((error: unknown) => {
  console.error("Failed to start AI Pixel Office API", error);
  process.exitCode = 1;
});
