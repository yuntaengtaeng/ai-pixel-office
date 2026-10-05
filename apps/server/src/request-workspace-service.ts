import { spawn, type ChildProcess } from "node:child_process";
import { readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DomainError, type Project } from "@ai-pixel-office/domain";
import { runtimeEnvironment } from "../../../scripts/runtime-spike/process.ts";
import { pathExists } from "./file-system.ts";
import { locateProjectRepository } from "./project-snapshot.ts";
import type { RequestWorkspaceBinding } from "./repository/request-workspaces.ts";
import {
  applyRequestWorkspace,
  copyIntoRequestWorkspace,
  createRequestWorkspace,
  discardRequestWorkspace,
  listRequestWorkspaceChanges,
  requestWorkspaceFileDiff,
  openRequestWorkspace,
  realignRequestWorkspace,
  refreshRequestBase,
  requestWorkspacePath,
  type ApplyResult,
  type RealignResult,
  type RequestWorkspace,
  type RequestWorkspaceAddress,
  type RequestWorkspaceChanges,
} from "./request-workspace.ts";

export type CommandResult = { exitCode: number; output: string };
export type CommandRunner = (
  command: string,
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal,
) => Promise<CommandResult>;

export type PrepareResult = { status: "ready" } | { status: "failed"; output: string };

const SETUP_TIMEOUT_MS = 15 * 60_000;
const OUTPUT_TAIL_CHARS = 4_000;

/** 기안서 작업 공간을 만들고 준비하고 반영하거나 버림 */
export class RequestWorkspaceService {
  private readonly workspacesRoot: string;
  private readonly runCommand: CommandRunner;

  constructor(workspacesRoot: string, runCommand: CommandRunner = runShellCommand) {
    this.workspacesRoot = workspacesRoot;
    this.runCommand = runCommand;
  }

  /**
   * 새 기안서를 격리할 작업 공간 주소
   * Git 저장소가 아니거나 Git이 없으면 undefined, 그 밖의 Git 오류는 예외 (조용히 격리를 끄지 않음)
   */
  async addressFor(project: Project, taskId: string): Promise<RequestWorkspaceAddress | undefined> {
    if (!project.path) return undefined;
    const location = await locateProjectRepository(project.path);
    if (!location) return undefined;
    return {
      project: location,
      workspacesRoot: this.workspacesRoot,
      projectId: project.id,
      taskId,
    };
  }

  /** 기록해 둔 격리 사실로 작업 공간 주소를 만듦 (Git을 다시 조회하지 않음) */
  addressFromBinding(binding: RequestWorkspaceBinding): RequestWorkspaceAddress {
    return {
      project: { repositoryRoot: binding.repositoryRoot, scope: binding.scope },
      workspacesRoot: this.workspacesRoot,
      projectId: binding.projectId,
      taskId: binding.taskId,
    };
  }

  async ensure(address: RequestWorkspaceAddress): Promise<RequestWorkspace> {
    return (await openRequestWorkspace(address)) ?? (await createRequestWorkspace(address));
  }

  /**
   * 가져올 파일 복사와 준비 명령 실행, 그 결과를 새 시작점으로 삼음
   * 한 번 성공하면 다시 하지 않음, signal로 취소
   */
  async prepare(
    workspace: RequestWorkspace,
    project: Project,
    signal?: AbortSignal,
  ): Promise<PrepareResult> {
    const marker = preparedMarkerPath(workspace.root);
    if (await pathExists(marker)) return { status: "ready" };
    if (project.path && project.copyFiles.length > 0)
      await copyIntoRequestWorkspace(workspace, project.path, project.copyFiles);
    if (project.setupCommand) {
      const result = await this.runCommand(
        project.setupCommand,
        workspace.runDirectory,
        SETUP_TIMEOUT_MS,
        signal,
      );
      if (result.exitCode !== 0)
        return { status: "failed", output: result.output.slice(-OUTPUT_TAIL_CHARS) };
      await refreshRequestBase(workspace);
    }
    await writeFile(marker, new Date().toISOString());
    return { status: "ready" };
  }

  async changes(address: RequestWorkspaceAddress): Promise<RequestWorkspaceChanges> {
    return listRequestWorkspaceChanges(await this.requireWorkspace(address));
  }

  async fileDiff(address: RequestWorkspaceAddress, path: string): Promise<string> {
    return requestWorkspaceFileDiff(await this.requireWorkspace(address), path);
  }

  async apply(address: RequestWorkspaceAddress): Promise<ApplyResult> {
    return applyRequestWorkspace(await this.requireWorkspace(address));
  }

  async realign(address: RequestWorkspaceAddress): Promise<RealignResult> {
    return realignRequestWorkspace(await this.requireWorkspace(address));
  }

  async discard(address: RequestWorkspaceAddress): Promise<void> {
    await discardRequestWorkspace(address);
    await rm(
      preparedMarkerPath(
        requestWorkspacePath(address.workspacesRoot, address.projectId, address.taskId),
      ),
      { force: true },
    );
  }

  /** 작업 공간에서 실행한 기안서의 작업 공간 (없어졌으면 결재·변경 판단을 하지 않고 알림) */
  private async requireWorkspace(address: RequestWorkspaceAddress): Promise<RequestWorkspace> {
    const workspace = await openRequestWorkspace(address);
    if (!workspace) {
      throw new DomainError(
        "WORKSPACE_MISSING",
        "기안서 작업 공간을 찾을 수 없어요. 프로젝트 폴더는 바뀌지 않았어요.",
        409,
      );
    }
    return workspace;
  }
}

export type PruneLookup = {
  /** 아직 작업 공간이 필요한 기안서인지 (진행 중이거나 결재 전) */
  isLive: (taskId: string) => Promise<boolean>;
  /** 기록해 둔 작업 공간 주소 (기록이 없으면 undefined) */
  addressOf: (taskId: string) => RequestWorkspaceAddress | undefined;
};

/**
 * 끝났거나 지워진 기안서의 작업 공간 정리 (앱 시작 시)
 * 주소 기록이 있으면 Git 참조까지 지우고, 없으면 폴더만 지움
 */
export async function pruneRequestWorkspaces(
  service: RequestWorkspaceService,
  workspacesRoot: string,
  lookup: PruneLookup,
): Promise<number> {
  let pruned = 0;
  for (const projectId of await directoryNames(workspacesRoot)) {
    for (const taskId of await directoryNames(join(workspacesRoot, projectId))) {
      if (await lookup.isLive(taskId)) continue;
      const address = lookup.addressOf(taskId);
      if (address) await service.discard(address);
      else {
        const root = join(workspacesRoot, projectId, taskId);
        await rm(root, { recursive: true, force: true });
        await rm(preparedMarkerPath(root), { force: true });
      }
      pruned += 1;
    }
  }
  return pruned;
}

async function directoryNames(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/** 준비를 마친 작업 공간 표시 파일 (작업 공간 폴더 옆) */
function preparedMarkerPath(workspaceRoot: string): string {
  return `${workspaceRoot}.prepared`;
}

/**
 * 셸로 명령을 실행하고 종료 코드와 출력(표준 출력 + 표준 오류)을 돌려줌
 * 시간이 지나거나 취소되면 자식 프로세스까지 함께 끝냄
 */
export function runShellCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<CommandResult> {
  return new Promise((resolveResult) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      detached: process.platform !== "win32",
      env: runtimeEnvironment(),
    });
    let output = "";
    let settled = false;
    const append = (chunk: Buffer) => {
      output = (output + chunk.toString("utf8")).slice(-OUTPUT_TAIL_CHARS * 2);
    };
    const finish = (exitCode: number, note?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolveResult({ exitCode, output: note ? `${output}\n${note}` : output });
    };
    const stop = (note: string) => {
      killProcessTree(child);
      finish(-1, note);
    };
    const onAbort = () => stop("준비를 취소했어요.");
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    const timer = setTimeout(() => stop("준비 명령이 시간 안에 끝나지 않았어요."), timeoutMs);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", (error) => finish(-1, error.message));
    child.on("exit", (code) => finish(code ?? -1));
  });
}

function killProcessTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }).on(
      "error",
      () => undefined,
    );
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}
