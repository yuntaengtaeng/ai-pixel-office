import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { EventBus } from "./events.ts";
import { createHttpServer } from "./http.ts";
import { openDatabase } from "./database.ts";
import { Orchestrator } from "./orchestrator.ts";
import { Repository } from "./repository/index.ts";
import { ClaudeRuntimeAdapter } from "./runtime/claude.ts";
import { CodexRuntimeAdapter } from "./runtime/codex.ts";
import { RuntimeRouter } from "./runtime/index.ts";
import { KnowledgeDocumentStore } from "./knowledge-documents.ts";

export async function startServer(
  options: {
    port?: number;
    host?: string;
    databasePath?: string;
    staticRoot?: string;
    generalWorkingDirectory?: string;
  } = {},
) {
  const generalWorkingDirectory = resolveGeneralWorkingDirectory(options.generalWorkingDirectory);
  mkdirSync(generalWorkingDirectory, { recursive: true });
  const repository = new Repository(openDatabase(options.databasePath));
  const recoveredRuns = await repository.recoverInterruptedRuns();
  if (recoveredRuns > 0)
    console.warn(`Recovered ${recoveredRuns} interrupted AgentRun(s) as failed`);
  const events = new EventBus();
  const runtime = new RuntimeRouter({
    codex: new CodexRuntimeAdapter(),
    claude: new ClaudeRuntimeAdapter(),
  });
  const knowledgeDocuments = new KnowledgeDocumentStore(generalWorkingDirectory);
  const orchestrator = new Orchestrator(repository, runtime, events, {
    generalWorkingDirectory,
    knowledgeDocuments,
  });
  const server = createHttpServer({
    repository,
    orchestrator,
    events,
    generalWorkingDirectory,
    knowledgeDocuments,
    staticRoot: options.staticRoot,
  });
  const port = options.port ?? Number(process.env.PORT ?? 47372);
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  server.addHook("onClose", async () => repository.close());
  const address = await server.listen({ port, host });
  console.log(`AI Pixel Office API listening at ${address}`);
  return { server, repository, orchestrator, address };
}

export function resolveGeneralWorkingDirectory(configured?: string): string {
  const directory = configured ?? join(tmpdir(), "ai-pixel-office", "general");
  if (!isAbsolute(directory)) {
    throw new Error("generalWorkingDirectory must be an absolute path");
  }
  return resolve(directory);
}
