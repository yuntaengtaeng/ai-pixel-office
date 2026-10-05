import {
  DomainError,
  type ActivityType,
  type Agent,
  type AgentRun,
  type Project,
  type Task,
  type TaskResult,
  type TaskStatus,
} from "@ai-pixel-office/domain";
import type { ExecutionScopeResolver } from "./execution-scope.ts";
import type { Repository } from "./repository/index.ts";
import type { RunFacts } from "./request-engine/run-facts.ts";
import type { RunDecision } from "./request-engine/run-decision.ts";
import type { RequestWorkspaceService } from "./request-workspace-service.ts";
import type { RequestWorkspaceAddress, RequestWorkspaceChanges } from "./request-workspace.ts";
import { realignConflictPrompt, verificationFailedPrompt } from "./run-prompts.ts";

export type RequestWorkspaceSummary =
  { isolated: false } | ({ isolated: true } & RequestWorkspaceChanges);

/** 기안서의 기존 세션을 이어 run을 예약할 때 넘기는 값 */
export type RunContinuation = {
  agentId: string;
  sessionRun?: AgentRun;
  prompt: string;
  request: string;
  expectedTaskStatus?: TaskStatus;
  verificationRetry?: boolean;
};

/** 기안서 흐름이 run을 시작하거나 놓을 때 쓰는 Orchestrator 기능 */
export type RunStarter = {
  continueRun: (task: Task, input: RunContinuation) => Promise<AgentRun>;
  requireRuntimeAgent: (task: Task) => Promise<Agent>;
  /** 끝난 run의 타이머와 실행 상태를 정리 */
  releaseRun: (runId: string) => void;
};

/** 활동 기록과 화면 갱신 알림 */
export type RequestNotifier = {
  activity: (
    task: Task,
    type: ActivityType,
    message: string,
    runId?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
  publishTask: (task: Task) => void;
  publishResult: (task: Task) => void;
};

type LifecycleRepository = Pick<
  Repository,
  "getTask" | "latestRun" | "listRuns" | "listReviews" | "transitionTask" | "createReview"
>;

/**
 * 기안서 흐름 (run 판단 결과 적용, 결재 반영, 겹침 맞추기, 작업 공간 정리)
 * run을 예약하고 실행하는 일은 Orchestrator가 하고, 여기서는 RunStarter로 요청만 함
 */
export class RequestLifecycle {
  private readonly repository: LifecycleRepository;
  private readonly requestWorkspaces?: RequestWorkspaceService;
  private readonly scopes: ExecutionScopeResolver;
  private readonly runs: RunStarter;
  private readonly notify: RequestNotifier;
  /** 결재를 반영하는 중인 기안서 (그동안 다른 run 예약과 중복 결재를 막음) */
  private readonly approving = new Set<string>();

  constructor(dependencies: {
    repository: LifecycleRepository;
    requestWorkspaces?: RequestWorkspaceService;
    scopes: ExecutionScopeResolver;
    runs: RunStarter;
    notify: RequestNotifier;
  }) {
    this.repository = dependencies.repository;
    this.requestWorkspaces = dependencies.requestWorkspaces;
    this.scopes = dependencies.scopes;
    this.runs = dependencies.runs;
    this.notify = dependencies.notify;
  }

  isApproving(taskId: string): boolean {
    return this.approving.has(taskId);
  }

  /** 결재 (작업 공간 변경을 프로젝트 폴더에 반영한 뒤 완료) */
  async approve(taskId: string): Promise<Task> {
    if (this.approving.has(taskId)) {
      throw new DomainError("TASK_APPROVING", "이미 결재를 반영하고 있어요.", 409);
    }
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_review") {
      throw new DomainError(
        "TASK_NOT_REVIEWABLE",
        "Only a task awaiting review can be approved",
        409,
      );
    }
    const latestRun = await this.repository.latestRun(task.id);
    this.approving.add(taskId);
    try {
      return await this.applyApproval(task, latestRun);
    } finally {
      this.approving.delete(taskId);
    }
  }

  /**
   * 결재가 겹쳐 반영되지 않은 기안서를 프로젝트 폴더의 지금 상태에 맞춰 다시 얹음
   * 겹친 파일이 있으면 마지막으로 일한 동료에게 정리를 맡기고, 없으면 바로 다시 결재할 수 있음
   */
  async realign(taskId: string): Promise<Task | AgentRun> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_review") {
      throw new DomainError("TASK_NOT_REVIEWABLE", "결재를 기다리는 기안서만 맞출 수 있어요", 409);
    }
    const workspace = await this.workspaceOf(task);
    if (!workspace || !this.requestWorkspaces) {
      throw new DomainError(
        "WORKSPACE_NOT_ISOLATED",
        "작업 공간에서 실행한 기안서만 맞출 수 있어요",
        409,
      );
    }
    const { conflictedFiles } = await this.requestWorkspaces.realign(workspace);
    const latestRun = await this.repository.latestRun(task.id);
    await this.notify.activity(
      task,
      "workspace_realigned",
      "프로젝트 폴더의 지금 상태에 맞췄어요",
      latestRun?.id,
      { conflictedFiles },
    );
    if (conflictedFiles.length === 0) return (await this.repository.getTask(task.id)) ?? task;
    return this.runs.continueRun(task, {
      agentId: latestRun?.agentId ?? (await this.runs.requireRuntimeAgent(task)).id,
      sessionRun: latestRun,
      prompt: realignConflictPrompt(conflictedFiles),
      request: "먼저 반영된 변경과 겹친 곳 정리",
      expectedTaskStatus: "needs_review",
    });
  }

  /** 화면에 보여줄 작업 공간 변경 요약 (작업 공간이 이미 정리됐으면 바뀐 파일 없음) */
  async workspaceSummary(task: Task): Promise<RequestWorkspaceSummary> {
    const workspace = await this.workspaceOf(task);
    if (!workspace || !this.requestWorkspaces) return { isolated: false };
    if (task.status === "done") return { isolated: true, inside: [], outside: [] };
    try {
      return { isolated: true, ...(await this.requestWorkspaces.changes(workspace)) };
    } catch (error) {
      if (error instanceof DomainError && error.code === "WORKSPACE_MISSING")
        return { isolated: true, inside: [], outside: [] };
      throw error;
    }
  }

  /** 결재 전 작업 공간에서 파일 하나가 바뀐 내용 */
  async workspaceFileDiff(task: Task, path: string): Promise<string> {
    const workspace = await this.workspaceOf(task);
    if (!workspace || !this.requestWorkspaces || task.status === "done") {
      throw new DomainError(
        "WORKSPACE_NOT_AVAILABLE",
        "결재 전 작업 공간에서 실행한 기안서만 바뀐 내용을 볼 수 있어요",
        409,
      );
    }
    return this.requestWorkspaces.fileDiff(workspace, path);
  }

  /** 기안서의 작업 공간을 버림 (사용자 프로젝트 폴더는 그대로) */
  async discardWorkspace(task: Task): Promise<void> {
    const workspace = await this.workspaceOf(task);
    if (workspace && this.requestWorkspaces) await this.requestWorkspaces.discard(workspace);
  }

  /** 결재할 변경이 있는지 (작업 공간이면 시작점 대비 차이, 아니면 결재 뒤 파일 쓰기 도구 기록) */
  async hasFileChanges(
    task: Task,
    project: Project | undefined,
    facts: RunFacts,
  ): Promise<boolean> {
    if (!project) return false;
    const workspace = await this.workspaceOf(task);
    if (workspace && this.requestWorkspaces) {
      return (await this.requestWorkspaces.changes(workspace)).inside.length > 0;
    }
    if (facts.changedPaths.length > 0) return true;
    return (await this.changedPathsSinceApproval(task.id)).length > 0;
  }

  /** run 판단 결과대로 사람에게 묻기, 되돌려 보내기, 결재 대기, 완료 중 하나를 실행 */
  async applyRunDecision(
    decision: RunDecision,
    context: { task: Task; run: AgentRun; result: TaskResult },
  ): Promise<void> {
    const { task, run, result } = context;
    const transition = async (status: Task["status"]) => {
      const updated = await this.repository.transitionTask(task.id, status, result);
      this.notify.publishTask(updated);
      return updated;
    };

    switch (decision.kind) {
      case "final_review": {
        await this.notify.activity(
          task,
          "task_completed",
          "Task result is ready for review",
          run.id,
        );
        this.notify.publishResult(await transition("needs_review"));
        return;
      }
      case "complete_without_approval": {
        await this.discardWorkspace(task);
        await this.notify.activity(
          task,
          "task_completed_without_changes",
          "바뀐 파일 없이 끝났어요",
          run.id,
        );
        this.notify.publishResult(await transition("done"));
        return;
      }
      case "ask_user": {
        await this.notify.activity(
          task,
          "result_questions_asked",
          "사용자에게 묻는 질문이 있어요",
          run.id,
          { questions: decision.questions },
        );
        await transition("needs_input");
        return;
      }
      case "stop_incomplete_result": {
        await this.notify.activity(
          task,
          "result_incomplete",
          "결과가 형식을 갖추지 못했어요",
          run.id,
          { missingFields: decision.missingFields },
        );
        await transition("blocked");
        return;
      }
      case "stop_verification_failed": {
        await this.notify.activity(
          task,
          "verification_failed",
          "프로젝트 확인이 다시 실패했어요",
          run.id,
          { failed: decision.failed },
        );
        await transition("blocked");
        return;
      }
      case "return_to_assignee": {
        await this.notify.activity(
          task,
          "verification_returned",
          "확인 실패로 같은 동료에게 다시 맡겼어요",
          run.id,
          { failed: decision.failed },
        );
        this.runs.releaseRun(run.id);
        await this.returnToAssignee(task, run, decision.failed);
        return;
      }
    }
  }

  /** 작업 공간 변경을 프로젝트 폴더에 반영하고 기안서를 완료 (겹치면 아무것도 바꾸지 않고 알림) */
  private async applyApproval(task: Task, latestRun: AgentRun | undefined): Promise<Task> {
    const workspace = await this.workspaceOf(task);
    if (workspace && this.requestWorkspaces) {
      const applied = await this.requestWorkspaces.apply(workspace);
      if (applied.status === "conflict") {
        await this.notify.activity(
          task,
          "workspace_conflict",
          "먼저 반영된 변경과 겹쳐요",
          latestRun?.id,
          { detail: applied.detail },
        );
        throw new DomainError(
          "WORKSPACE_CONFLICT",
          "프로젝트 폴더에 먼저 반영된 변경과 겹쳐서 반영하지 못했어요",
          409,
        );
      }
      await this.requestWorkspaces.discard(workspace);
    }
    await this.repository.createReview({
      taskId: task.id,
      runId: latestRun?.id,
      action: "approved",
    });
    const updated = await this.repository.transitionTask(task.id, "done");
    await this.notify.activity(updated, "task_approved", "Task result approved", latestRun?.id);
    this.notify.publishTask(updated);
    return updated;
  }

  /** 실패한 확인을 근거로 같은 동료의 같은 세션에 다시 맡김 */
  private async returnToAssignee(
    task: Task,
    run: AgentRun,
    failed: Array<{ command: string }>,
  ): Promise<void> {
    try {
      const current = (await this.repository.getTask(task.id)) ?? task;
      await this.runs.continueRun(current, {
        agentId: run.agentId,
        sessionRun: run,
        prompt: verificationFailedPrompt(failed.map((check) => check.command)),
        request: "확인 실패를 고쳐 다시 진행",
        verificationRetry: true,
      });
    } catch (error) {
      await this.failTask(task, error);
    }
  }

  /** run을 시작하지 못한 기안서를 실패로 */
  private async failTask(task: Task, error: unknown): Promise<void> {
    const failedTask = await this.repository.transitionTask(task.id, "failed");
    await this.notify.activity(
      failedTask,
      "task_failed",
      error instanceof Error ? error.message : String(error),
    );
    this.notify.publishTask(failedTask);
  }

  /** 기안서가 쓰는 작업 공간 주소 (격리 실행이 아니면 undefined) */
  private async workspaceOf(task: Task): Promise<RequestWorkspaceAddress | undefined> {
    if (!task.projectId || !this.requestWorkspaces) return undefined;
    return (await this.scopes.resolve(task)).workspace;
  }

  /** 프로젝트 폴더에서 직접 실행한 기안서가 마지막 결재 뒤 파일 쓰기 도구로 바꾼 경로 */
  private async changedPathsSinceApproval(taskId: string): Promise<string[]> {
    const approvedAt = (await this.repository.listReviews(taskId)).find(
      (review) => review.action === "approved",
    )?.createdAt;
    return (await this.repository.listRuns(taskId))
      .filter((run) => !approvedAt || run.createdAt > approvedAt)
      .flatMap((run) => {
        const paths = run.result?.metadata?.changedPaths;
        return Array.isArray(paths) ? paths.map(String) : [];
      });
  }
}
