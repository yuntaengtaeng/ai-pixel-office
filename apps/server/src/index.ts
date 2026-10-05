import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { EventBus } from "./events.ts";
import { createHttpServer } from "./http.ts";
import { LEGACY_DATA_RESET_KEY, openDatabase } from "./database.ts";
import { clearAppOwnedDirectories } from "./app-data.ts";
import { SkillLibrary } from "./skill-library.ts";
import {
  pruneRequestWorkspaces,
  RequestWorkspaceService,
} from "./request-workspace-service.ts";
import { Orchestrator } from "./orchestrator.ts";
import { loadBundledTeams, workGuideLines } from "./bundled-teams.ts";
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
    runtimeLogDirectory?: string;
    /** 앱 스킬 라이브러리 폴더 (기본값은 general 폴더 옆의 library) */
    libraryDirectory?: string;
    /** 앱과 함께 배포되는 Team 패키지 폴더 */
    bundledTeamsDirectory?: string;
    /** 기안서 작업 공간 폴더 (기본값은 general 폴더 옆의 workspaces) */
    workspacesDirectory?: string;
  } = {},
) {
  const generalWorkingDirectory = resolveGeneralWorkingDirectory(options.generalWorkingDirectory);
  const runtimeLogDirectory = resolveRuntimeLogDirectory(
    options.runtimeLogDirectory,
    generalWorkingDirectory,
  );
  mkdirSync(generalWorkingDirectory, { recursive: true });
  mkdirSync(runtimeLogDirectory, { recursive: true });
  const repository = new Repository(openDatabase(options.databasePath));
  const skillLibrary = new SkillLibrary(
    options.libraryDirectory ?? join(dirname(generalWorkingDirectory), "library"),
  );
  await clearFilesOfResetData(
    repository,
    [generalWorkingDirectory, runtimeLogDirectory],
    skillLibrary,
  );
  const recoveredRuns = await repository.recoverInterruptedRuns();
  if (recoveredRuns > 0)
    console.warn(`Recovered ${recoveredRuns} interrupted AgentRun(s) as failed`);
  const events = new EventBus();
  const runtime = new RuntimeRouter({
    codex: new CodexRuntimeAdapter(runtimeLogDirectory),
    claude: new ClaudeRuntimeAdapter(runtimeLogDirectory),
  });
  const knowledgeDocuments = new KnowledgeDocumentStore(generalWorkingDirectory);
  const workspacesDirectory =
    options.workspacesDirectory ?? join(dirname(generalWorkingDirectory), "workspaces");
  const requestWorkspaces = new RequestWorkspaceService(workspacesDirectory);
  const prunedWorkspaces = await pruneRequestWorkspaces(requestWorkspaces, workspacesDirectory, {
    isLive: async (taskId) => {
      const task = await repository.getTask(taskId);
      return task !== undefined && task.status !== "done";
    },
    addressOf: (taskId) => {
      const binding = repository.getRequestWorkspaceBinding(taskId);
      return binding ? requestWorkspaces.addressFromBinding(binding) : undefined;
    },
  });
  if (prunedWorkspaces > 0) console.warn(`Removed ${prunedWorkspaces} finished request workspace(s)`);
  const orchestrator = new Orchestrator(repository, runtime, events, {
    generalWorkingDirectory,
    knowledgeDocuments,
    skillLibrary,
    requestWorkspaces,
    workGuides: (agents) =>
      workGuideLines(loadBundledTeams(options.bundledTeamsDirectory ?? ""), agents),
  });
  const server = createHttpServer({
    repository,
    orchestrator,
    events,
    generalWorkingDirectory,
    runtimeLogDirectory,
    knowledgeDocuments,
    skillLibrary,
    bundledTeamsDirectory: options.bundledTeamsDirectory,
    staticRoot: options.staticRoot,
  });
  const port = options.port ?? Number(process.env.PORT ?? 47372);
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  server.addHook("onClose", async () => repository.close());
  const address = await server.listen({ port, host });
  console.log(`AI Pixel Office API listening at ${address}`);
  return { server, repository, orchestrator, address };
}

const LEGACY_FILES_CLEARED_KEY = "legacy_data_files_cleared_at";

/** 이전 데이터 버전 DB가 초기화된 뒤 처음 시작할 때 앱 소유 파일도 한 번 비움 */
async function clearFilesOfResetData(
  repository: Repository,
  appOwnedDirectories: string[],
  skillLibrary: SkillLibrary,
): Promise<void> {
  const resetAt = repository.getAppMeta(LEGACY_DATA_RESET_KEY);
  if (!resetAt || repository.getAppMeta(LEGACY_FILES_CLEARED_KEY) === resetAt) return;
  await clearAppOwnedDirectories(appOwnedDirectories);
  skillLibrary.clear();
  repository.setAppMeta(LEGACY_FILES_CLEARED_KEY, resetAt);
}

export function resolveGeneralWorkingDirectory(configured?: string): string {
  const directory = configured ?? join(tmpdir(), "ai-pixel-office", "general");
  if (!isAbsolute(directory)) {
    throw new Error("generalWorkingDirectory must be an absolute path");
  }
  return resolve(directory);
}

export function resolveRuntimeLogDirectory(
  configured: string | undefined,
  generalWorkingDirectory: string,
): string {
  const directory = configured ?? join(generalWorkingDirectory, ".runtime-logs");
  if (!isAbsolute(directory)) {
    throw new Error("runtimeLogDirectory must be an absolute path");
  }
  return resolve(directory);
}
