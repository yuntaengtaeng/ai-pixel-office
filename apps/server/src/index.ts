import { pathToFileURL } from "node:url";
import { EventBus } from "./events.ts";
import { createHttpServer } from "./http.ts";
import { openDatabase } from "./database.ts";
import { Orchestrator } from "./orchestrator.ts";
import { Repository } from "./repository.ts";
import { ClaudeRuntimeAdapter } from "./claude-runtime.ts";
import { CodexRuntimeAdapter, RuntimeRouter } from "./runtime.ts";

export async function startServer(
  options: { port?: number; host?: string; databasePath?: string } = {},
) {
  const repository = new Repository(openDatabase(options.databasePath));
  const recoveredRuns = repository.recoverInterruptedRuns();
  if (recoveredRuns > 0)
    console.warn(`Recovered ${recoveredRuns} interrupted AgentRun(s) as failed`);
  const events = new EventBus();
  const runtime = new RuntimeRouter({
    codex: new CodexRuntimeAdapter(),
    claude: new ClaudeRuntimeAdapter(),
  });
  const orchestrator = new Orchestrator(repository, runtime, events);
  const server = createHttpServer({ repository, orchestrator, events });
  const port = options.port ?? Number(process.env.PORT ?? 47372);
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  server.addHook("onClose", async () => repository.close());
  const address = await server.listen({ port, host });
  console.log(`AI Pixel Office API listening at ${address}`);
  return { server, repository, orchestrator };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await startServer();
