import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  DomainError,
  type AgentRun,
  type ExecutionScopeType,
  type Project,
  type Task,
} from "@ai-pixel-office/domain";
import type { Repository } from "./repository/index.ts";
import type { RequestWorkspaceService } from "./request-workspace-service.ts";
import { requestWorkspaceRunDirectory, type RequestWorkspaceAddress } from "./request-workspace.ts";

/** 기안서가 실행되는 범위와 경로 */
export type ExecutionScope = {
  type: ExecutionScopeType;
  projectId?: string;
  projectPath?: string;
  /** 동료가 실행되는 경로 (프로젝트 폴더, 작업 공간 안의 프로젝트 폴더, 또는 앱 전용 폴더) */
  workingDirectory: string;
  project?: Project;
  /** 격리 실행이면 기안서 작업 공간 주소 */
  workspace?: RequestWorkspaceAddress;
};

type ScopeRepository = Pick<Repository, "getProject" | "firstRun" | "getRequestWorkspaceBinding">;

/** 기안서의 실행 범위 결정 (프로젝트 없음 → 앱 전용 폴더, Git 프로젝트 → 기안서 작업 공간) */
export class ExecutionScopeResolver {
  private readonly repository: ScopeRepository;
  private readonly generalWorkingDirectory: string;
  private readonly requestWorkspaces?: RequestWorkspaceService;

  constructor(
    repository: ScopeRepository,
    generalWorkingDirectory: string,
    requestWorkspaces?: RequestWorkspaceService,
  ) {
    this.repository = repository;
    this.generalWorkingDirectory = resolve(generalWorkingDirectory);
    this.requestWorkspaces = requestWorkspaces;
  }

  async resolve(task: Task): Promise<ExecutionScope> {
    const project = task.projectId ? await this.repository.getProject(task.projectId) : undefined;
    if (task.projectId && (!project || project.workspaceId !== task.workspaceId)) {
      throw new DomainError(
        "PROJECT_NOT_FOUND",
        `프로젝트를 찾을 수 없습니다: ${task.projectId}`,
        422,
      );
    }
    if (project && !project.path) {
      throw new DomainError("PROJECT_PATH_REQUIRED", "프로젝트 폴더를 먼저 설정해 주세요", 422);
    }
    const type: ExecutionScopeType = project ? "project" : "general";
    const directory = existingDirectory(
      resolve(project?.path ?? this.generalWorkingDirectory),
      type,
    );
    const workspace = project
      ? await this.isolatedWorkspaceFor(task, project, directory)
      : undefined;
    return {
      type,
      projectId: project?.id,
      projectPath: project?.path,
      workingDirectory: workspace ? requestWorkspaceRunDirectory(workspace) : directory,
      ...(project ? { project } : {}),
      ...(workspace ? { workspace } : {}),
    };
  }

  /** 이전 run과 실행 범위가 같은지 확인 (다르면 같은 세션을 이어갈 수 없음) */
  async assertUnchanged(task: Task, previousRun: AgentRun | undefined): Promise<void> {
    assertMatchingExecutionScope(previousRun, await this.resolve(task));
  }

  /**
   * 격리해 실행할 기안서의 작업 공간 주소
   * 한 번 작업 공간을 만든 기안서는 기록한 주소를 쓰고 Git을 다시 조회하지 않음
   * Git 저장소가 아니거나, 이미 프로젝트 폴더에서 직접 실행한 기안서면 undefined
   */
  private async isolatedWorkspaceFor(
    task: Task,
    project: Project,
    projectDirectory: string,
  ): Promise<RequestWorkspaceAddress | undefined> {
    if (!this.requestWorkspaces) return undefined;
    const binding = this.repository.getRequestWorkspaceBinding(task.id);
    if (binding) return this.requestWorkspaces.addressFromBinding(binding);
    const firstRun = await this.repository.firstRun(task.id);
    if (firstRun && firstRun.workingDirectory === projectDirectory) return undefined;
    return this.requestWorkspaces.addressFor(project, task.id);
  }
}

export function assertMatchingExecutionScope(
  previousRun: AgentRun | undefined,
  scope: ExecutionScope,
): void {
  if (
    previousRun &&
    (previousRun.scopeType !== scope.type ||
      previousRun.scopeProjectId !== scope.projectId ||
      previousRun.workingDirectory !== scope.workingDirectory)
  ) {
    throw new DomainError(
      "EXECUTION_SCOPE_CHANGED",
      "기존 세션의 프로젝트가 변경되어 이어서 실행할 수 없습니다",
      409,
    );
  }
}

function existingDirectory(configured: string, type: ExecutionScopeType): string {
  try {
    if (!statSync(configured).isDirectory()) throw new Error("not a directory");
    return realpathSync.native(configured);
  } catch {
    const scopeLabel = type === "project" ? "프로젝트" : "일반 대화";
    throw new DomainError(
      "WORKING_DIRECTORY_INVALID",
      `${scopeLabel} 폴더를 찾을 수 없습니다: ${configured}`,
      422,
    );
  }
}
