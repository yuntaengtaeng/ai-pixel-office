import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  compileAgentInstructions,
  DomainError,
  ProjectBusyError,
  type QueuedRequest,
  type Agent,
  type AgentRun,
  type MessageAttachment,
  type Project,
  type RunLimits,
  type Skill,
  type Task,
  type TaskResult,
} from "@ai-pixel-office/domain";
import type { AgentEvent, ApprovalDecision } from "@ai-pixel-office/runtime-protocol";
import { EventBus } from "./events.ts";
import { RequestQueue, releasesProjectSlot } from "./request-queue.ts";
import { ProjectLead } from "./lead/project-lead.ts";
import { Repository } from "./repository/index.ts";
import type { RuntimeAdapter } from "./runtime/index.ts";
import { selectModel } from "./model-routing.ts";
import { inspectProjectRuntimeContext, type ProjectRuntimeContext } from "./project-context.ts";
import type { KnowledgeDocumentStore } from "./knowledge-documents.ts";
import type { SkillLibrary } from "./skill-library.ts";
import { checkOutputContract } from "./request-engine/output-contract.ts";
import { collectRunFacts, type RunFacts } from "./request-engine/run-facts.ts";
import { decideAfterRun } from "./request-engine/run-decision.ts";
import { isWaitingForEarlierRequests, readyPlanTasks } from "./request-engine/plan-order.ts";
import { buildRunGuidance, resultFormatSection } from "./request-engine/run-guidance.ts";
import { verificationFacts } from "./request-engine/verification.ts";
import type { RequestWorkspaceService } from "./request-workspace-service.ts";
import type { RequestWorkspaceAddress } from "./request-workspace.ts";
import { assertMatchingExecutionScope, ExecutionScopeResolver } from "./execution-scope.ts";
import { TaskDocumentGenerator, type GeneratedTaskDocument } from "./task-document-generator.ts";
import { RequestLifecycle, type RequestWorkspaceSummary } from "./request-lifecycle.ts";
import {
  continuationRequestLabel,
  describeAttachments,
  newSessionContinuationPrompt,
  revisionRequestPrompt,
  sameSessionContinuationPrompt,
  withReferenceDocumentsPrompt,
} from "./run-prompts.ts";

/**
 * 기본 실행 한도 (멈춘 실행을 알아채고 끝없는 실행의 비용을 막음)
 * 설치·빌드나 긴 구현도 끊기지 않을 만큼 넉넉하게 둠
 */
const DEFAULT_RUN_LIMITS: RunLimits = {
  maxDurationMs: 90 * 60_000,
  idleTimeoutMs: 15 * 60_000,
  maxTurns: 300,
  maxTokens: 1_000_000,
};

type ActiveRunContext = {
  workspaceId: string;
  taskId: string;
  limitReason?: "capacity" | "inactivity" | "duration";
  sessionWarningEmitted?: boolean;
  idleTimer?: NodeJS.Timeout;
  hardTimer?: NodeJS.Timeout;
  cancelRequested?: boolean;
  workingDirectory: string;
  sessionBudget?: SessionBudget;
  attachments?: MessageAttachment[];
  workspace?: RunWorkspace;
  /** 확인 실패로 되돌려 보낸 run (재시도 한도) */
  verificationRetry?: boolean;
  /** 결과 보고 도구를 붙일지 */
  resultReporting?: boolean;
  /** 작업 공간 준비(준비 명령)를 멈춤 */
  abortPreparation?: () => void;
};

/** 기안서 작업 공간에서 실행하는 run의 작업 공간 정보 */
type RunWorkspace = {
  address: RequestWorkspaceAddress;
  project: Project;
  /** 이 run 전에 준비 명령을 실행해야 하는지 (파일을 고치는 기안서) */
  prepare: boolean;
};

type SessionBudget = {
  usageBaselineTokens: number;
  maxAdditionalTokens: number;
};

/** run 하나를 예약할 때 필요한 값 */
type RunRequest = {
  task: Task;
  agent: Agent;
  prompt: string;
  resumeThreadId?: string;
  sessionBudget?: SessionBudget;
  /** 사용자에게 보이는 요청 문구 (기본값은 기안서 설명이나 제목) */
  request?: string;
} & RunReservationOptions;

type RunReservationOptions = {
  expectedTaskStatus?: Task["status"];
  expectedAssigneeAgentId?: string;
  resumedFromRunId?: string;
  review?: Parameters<Repository["createReview"]>[0];
  activities?: Array<Parameters<Repository["createActivity"]>[0]>;
  /** 업로드는 이미 끝난 상태로 들어오며, run이 만들어진 뒤 그 run에 소급해서 묶는다. */
  attachmentIds?: string[];
  verificationRetry?: boolean;
};

export type OrchestratorOptions = {
  generalWorkingDirectory: string;
  concurrentRunLimit?: number;
  defaultRunLimits?: RunLimits;
  knowledgeDocuments?: KnowledgeDocumentStore;
  skillLibrary?: SkillLibrary;
  requestWorkspaces?: RequestWorkspaceService;
  /** 설치한 팀이 보통 일하는 순서 안내 (프로젝트 팀장이 읽음) */
  workGuides?: (agents: Agent[]) => string[];
};

export type TaskExecutionContext = ProjectRuntimeContext & {
  agentId: string;
  agentName: string;
};

export class Orchestrator {
  private readonly repository: Repository;
  private readonly runtime: RuntimeAdapter;
  private readonly events: EventBus;
  private readonly generalWorkingDirectory: string;
  private readonly concurrentRunLimit: number;
  private readonly limits: RunLimits;
  private readonly knowledgeDocuments?: KnowledgeDocumentStore;
  private readonly skillLibrary?: SkillLibrary;
  private readonly requestWorkspaces?: RequestWorkspaceService;
  private readonly scopes: ExecutionScopeResolver;
  private readonly activeRuns = new Map<string, ActiveRunContext>();
  private readonly lifecycle: RequestLifecycle;
  private readonly queue: RequestQueue;
  private readonly eventQueues = new Map<string, Promise<void>>();
  private readonly documents: TaskDocumentGenerator;
  /** 프로젝트 팀장 (대화, 계획서 결재·반려) */
  readonly lead: ProjectLead;

  constructor(
    repository: Repository,
    runtime: RuntimeAdapter,
    events: EventBus,
    options: OrchestratorOptions,
  ) {
    this.repository = repository;
    this.runtime = runtime;
    this.events = events;
    this.generalWorkingDirectory = resolve(options.generalWorkingDirectory);
    this.concurrentRunLimit = options.concurrentRunLimit ?? 2;
    this.knowledgeDocuments = options.knowledgeDocuments;
    this.skillLibrary = options.skillLibrary;
    this.requestWorkspaces = options.requestWorkspaces;
    this.scopes = new ExecutionScopeResolver(
      repository,
      options.generalWorkingDirectory,
      options.requestWorkspaces,
    );
    this.limits = options.defaultRunLimits ?? DEFAULT_RUN_LIMITS;
    this.queue = new RequestQueue({
      repository,
      start: (taskId, attachmentIds) => this.startPendingRun(taskId, attachmentIds),
      publish: {
        task: (task) => this.publishTask(task),
        activity: (activity) => this.publishActivity(activity),
      },
    });
    this.lifecycle = new RequestLifecycle({
      repository,
      requestWorkspaces: options.requestWorkspaces,
      scopes: this.scopes,
      runs: {
        continueRun: (task, input) => this.continueRun(task, input),
        requireRuntimeAgent: (task) => this.requireRuntimeAgent(task),
        releaseRun: (runId) => {
          this.clearRunTimers(runId);
          this.activeRuns.delete(runId);
        },
      },
      notify: {
        activity: (task, type, message, runId, metadata) =>
          this.activity(task, type, message, runId, metadata),
        publishTask: (task) => this.publishTask(task),
        publishResult: (task) =>
          this.events.publish({
            type: "task.result_updated",
            workspaceId: task.workspaceId,
            data: { task },
          }),
      },
    });
    this.documents = new TaskDocumentGenerator({
      repository,
      runtime,
      scopes: this.scopes,
      requireSkills: (skillIds) => this.skillsFor(skillIds),
      limits: this.limits,
    });
    this.lead = new ProjectLead({
      repository,
      runtime,
      events,
      limits: this.limits,
      startPlan: (planId) => this.startReadyPlanTasks(planId),
      workGuides: options.workGuides ?? (() => []),
    });
  }

  async getTaskExecutionContexts(taskId: string): Promise<TaskExecutionContext[]> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (!task.assigneeAgentId) return [];
    const agent = await this.repository.getAgent(task.assigneeAgentId);
    if (!agent) throw new DomainError("NOT_FOUND", `Agent not found: ${task.assigneeAgentId}`, 404);
    const executionScope = await this.scopes.resolve(task);
    return [
      {
        agentId: agent.id,
        agentName: agent.name,
        ...inspectProjectRuntimeContext(agent.model, executionScope.workingDirectory),
      },
    ];
  }

  async generateTaskDocument(taskId: string): Promise<GeneratedTaskDocument> {
    return this.documents.generate(taskId);
  }

  /** 기안서 시작 (같은 프로젝트 폴더를 다른 기안서가 쓰고 있으면 순서 대기로 두고 그 결과를 돌려줌) */
  async startTask(taskId: string, attachmentIds: string[] = []): Promise<AgentRun | QueuedRequest> {
    try {
      return await this.startPendingRun(taskId, attachmentIds);
    } catch (error) {
      if (!(error instanceof ProjectBusyError)) throw error;
      const task = await this.requireRunnableTask(taskId, "todo");
      return { queued: true, task: await this.queue.enqueue(task, error, attachmentIds) };
    }
  }

  /** 같은 프로젝트의 순서 대기를 깨워 봄 (기안서를 지운 뒤처럼 상태 변경 없이 자리가 빌 때) */
  async resumeQueuedRequests(projectId: string): Promise<void> {
    await this.queue.resume(projectId);
  }

  /** 시작 전 기안서의 첫 run */
  private async startPendingRun(taskId: string, attachmentIds: string[]): Promise<AgentRun> {
    const task = await this.requireRunnableTask(taskId, "todo");
    if (
      task.planId &&
      isWaitingForEarlierRequests(task, await this.repository.listPlanTasks(task.planId))
    ) {
      throw new DomainError(
        "WAITING_FOR_EARLIER_REQUESTS",
        "앞 기안이 끝나야 시작할 수 있어요",
        409,
      );
    }
    const agent = await this.requireRuntimeAgent(task);
    return this.queueRun({
      task,
      agent,
      prompt: await this.instructionsFor(task, agent),
      attachmentIds: attachmentIds.length ? attachmentIds : this.queue.attachmentIdsOf(task),
    });
  }

  /** 동료 지침, 프로젝트 메모, 확인 방법, 결과 형식, 참고 문서를 담은 첫 지시 */
  private async instructionsFor(task: Task, agent: Agent): Promise<string> {
    const skills = await this.requireSkills(agent);
    const project = task.projectId ? await this.repository.getProject(task.projectId) : undefined;
    const guidance = buildRunGuidance({
      resultFormat: task.resultFormat,
      projectMemo: project?.memo,
      verificationCommands: project?.verificationCommands ?? [],
      earlierResults: await this.earlierResultsOf(task),
    });
    return this.withReferenceDocuments(
      `${compileAgentInstructions(agent, skills, task)}${guidance ? `\n\n${guidance}` : ""}`,
      task,
    );
  }

  /** 앞 기안이 낸 마지막 결과 */
  private async earlierResultsOf(
    task: Task,
  ): Promise<Array<{ title: string; summary: string; reportedResult?: unknown }>> {
    const results = [];
    for (const earlierId of task.waitsFor ?? []) {
      const earlier = await this.repository.getTask(earlierId);
      const run = (await this.repository.listRuns(earlierId)).find(
        (candidate) => candidate.status === "completed" && candidate.result,
      );
      if (!earlier || !run?.result) continue;
      results.push({
        title: earlier.title,
        summary: run.result.summary,
        reportedResult: run.result.metadata?.reportedResult,
      });
    }
    return results;
  }

  /** 결재한 계획서에서 앞 기안이 모두 끝난 기안서를 시작 (폴더가 차 있으면 순서 대기) */
  async startReadyPlanTasks(planId: string): Promise<void> {
    for (const task of readyPlanTasks(await this.repository.listPlanTasks(planId))) {
      // 사람이 취소해 시작 전으로 돌아간 기안서는 다시 시작하지 않음
      if ((await this.repository.listRuns(task.id)).length > 0) continue;
      try {
        await this.startPendingRun(task.id, []);
      } catch (error) {
        if (error instanceof ProjectBusyError) {
          await this.queue.enqueue({ ...task, queuedBehind: undefined }, error);
          continue;
        }
        await this.activity(
          task,
          "task_failed",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  async retryTask(taskId: string): Promise<AgentRun> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "failed") {
      throw new DomainError("TASK_NOT_FAILED", "Only a failed task can be retried", 409);
    }
    await this.scopes.assertUnchanged(task, await this.repository.latestRun(task.id));
    const agent = await this.requireRuntimeAgent(task);
    return this.queueRun({
      task,
      agent,
      prompt: await this.instructionsFor(task, agent),
      expectedTaskStatus: "failed",
    });
  }

  /** 결재 (작업 공간 변경을 프로젝트 폴더에 반영한 뒤 완료) */
  async approveTask(taskId: string): Promise<Task> {
    return this.lifecycle.approve(taskId);
  }

  /** 결재가 겹친 기안서를 프로젝트 폴더의 지금 상태에 맞춰 다시 얹음 */
  async realignRequest(taskId: string): Promise<Task | AgentRun> {
    return this.lifecycle.realign(taskId);
  }

  /** 기안서 작업 공간에서 바뀐 파일 (작업 공간에서 실행하지 않는 기안서면 isolated: false) */
  async requestWorkspaceChanges(taskId: string): Promise<RequestWorkspaceSummary> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    return this.lifecycle.workspaceSummary(task);
  }

  /** 결재 전 작업 공간에서 파일 하나가 바뀐 내용 (unified diff) */
  async requestWorkspaceFileDiff(taskId: string, path: string): Promise<string> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    return this.lifecycle.workspaceFileDiff(task, path);
  }

  /** 기안서를 지우기 전에 작업 공간을 버림 (사용자 프로젝트 폴더는 그대로) */
  async discardTaskWorkspace(taskId: string): Promise<void> {
    const task = await this.repository.getTask(taskId);
    if (task) await this.lifecycle.discardWorkspace(task);
  }

  /** 반려: 담당 동료의 세션에 수정 요청을 보냄 */
  async requestChanges(
    taskId: string,
    feedback: string,
    attachmentIds: string[] = [],
  ): Promise<AgentRun> {
    const trimmed = feedback.trim();
    if (!trimmed) throw new DomainError("INVALID_FEEDBACK", "Feedback is required");
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_review") {
      throw new DomainError(
        "TASK_NOT_REVIEWABLE",
        "Only a task awaiting review can request changes",
        409,
      );
    }
    const previousRun = await this.repository.latestRun(task.id);
    await this.scopes.assertUnchanged(task, previousRun);
    return this.continueRun(task, {
      agentId: previousRun?.agentId ?? (await this.requireRuntimeAgent(task)).id,
      sessionRun: previousRun,
      prompt: revisionRequestPrompt(trimmed, task.title),
      request: trimmed,
      expectedTaskStatus: "needs_review",
      review: { taskId, runId: previousRun?.id, action: "changes_requested", feedback: trimmed },
      activities: [
        {
          workspaceId: task.workspaceId,
          type: "change_requested",
          taskId: task.id,
          agentId: task.assigneeAgentId,
          runId: previousRun?.id,
          message: `Changes requested: ${trimmed}`,
        },
      ],
      attachmentIds,
    });
  }

  /** 기안서 대화에 보낸 말을 담당 동료의 세션에 이어서 전달 */
  async sendChatMessage(
    taskId: string,
    message: string,
    attachmentIds: string[] = [],
  ): Promise<AgentRun> {
    const trimmed = message.trim();
    if (!trimmed) throw new DomainError("INVALID_MESSAGE", "Message is required");
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    const previousRun = await this.repository.latestRun(task.id);
    if (!previousRun) {
      throw new DomainError("TASK_NOT_STARTED", "대화를 먼저 시작해 주세요", 409);
    }
    if (task.status === "failed") {
      throw new DomainError(
        "TASK_NOT_CONTINUABLE",
        "실패한 대화는 다시 시도한 뒤 메시지를 보낼 수 있어요",
        409,
      );
    }
    if (task.status === "needs_input" && previousRun.error?.startsWith("SESSION_LIMIT:")) {
      throw new DomainError(
        "TASK_NEEDS_SESSION_ACTION",
        "세션 한도로 멈춘 대화입니다, 이어서 실행하거나 세션을 연장해 주세요",
        409,
      );
    }
    if (previousRun.status === "waiting") {
      throw new DomainError("TASK_WAITING_FOR_APPROVAL", "권한 요청에 먼저 답해 주세요", 409);
    }
    if (task.status === "working") {
      throw new DomainError("TASK_RUNNING", "이미 실행 중인 대화에는 메시지를 보낼 수 없어요", 409);
    }
    return this.continueRun(task, {
      agentId: previousRun.agentId,
      sessionRun: previousRun,
      prompt: trimmed,
      request: trimmed,
      attachmentIds,
    });
  }

  async continueTask(taskId: string): Promise<AgentRun> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_input") {
      throw new DomainError(
        "TASK_NOT_WAITING_FOR_SESSION",
        "작업 세션 한도로 일시 중단된 작업만 이어서 실행할 수 있습니다.",
        409,
      );
    }
    const previousRun = await this.repository.latestRun(task.id);
    if (!previousRun?.error?.startsWith("SESSION_LIMIT:")) {
      throw new DomainError(
        "SESSION_CONTINUATION_NOT_AVAILABLE",
        "이 작업은 새 세션 이어하기 대상이 아닙니다.",
        409,
      );
    }
    const context = await this.continuationContext(previousRun.id);
    const agent = await this.requireAgent(previousRun.agentId);
    const skills = await this.requireSkills(agent);
    return this.queueRun({
      task,
      agent,
      prompt: newSessionContinuationPrompt(compileAgentInstructions(agent, skills, task), context),
      request: continuationRequestLabel({ context }),
    });
  }

  async extendTaskSession(taskId: string): Promise<AgentRun> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_input") {
      throw new DomainError(
        "TASK_NOT_WAITING_FOR_SESSION",
        "작업 세션 한도로 일시 중단된 작업만 연장할 수 있습니다.",
        409,
      );
    }
    const previousRun = await this.repository.latestRun(task.id);
    if (!previousRun?.error?.startsWith("SESSION_LIMIT:")) {
      throw new DomainError(
        "SESSION_EXTENSION_NOT_AVAILABLE",
        "이 작업은 세션 연장 대상이 아닙니다.",
        409,
      );
    }
    if (!previousRun.runtimeThreadId) {
      throw new DomainError(
        "SESSION_RESUME_ID_MISSING",
        "기존 세션 식별자가 없어 새 세션으로 이어서 진행해야 합니다.",
        409,
      );
    }
    const context = await this.continuationContext(previousRun.id);
    const sessionBudget: SessionBudget = {
      usageBaselineTokens: runUsageTokens(previousRun),
      maxAdditionalTokens: Math.max(1, Math.floor((this.limits.maxTokens ?? 100_000) / 2)),
    };
    const agent = await this.requireAgent(previousRun.agentId);
    return this.queueRun({
      task,
      agent,
      prompt: sameSessionContinuationPrompt(context),
      resumeThreadId: previousRun.runtimeThreadId,
      sessionBudget,
      request: continuationRequestLabel({ context, sameSession: true }),
    });
  }

  /** 끝났거나 취소된 기안서를 고른 run의 세션에서 다시 엶 */
  async resumeTaskSession(
    taskId: string,
    sourceRunId: string,
    message: string,
    attachmentIds: string[] = [],
  ): Promise<AgentRun> {
    const request = message.trim();
    if (!request) throw new DomainError("INVALID_MESSAGE", "A continuation request is required");
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "done" && task.status !== "todo") {
      throw new DomainError(
        "TASK_NOT_RESUMABLE",
        "Only completed or cancelled tasks can resume a session",
        409,
      );
    }
    const sourceRun = await this.repository.getRun(sourceRunId);
    if (
      !sourceRun ||
      sourceRun.taskId !== task.id ||
      !["completed", "cancelled"].includes(sourceRun.status) ||
      !sourceRun.runtimeThreadId
    ) {
      throw new DomainError(
        "SESSION_NOT_RESUMABLE",
        "The selected run cannot resume a session",
        409,
      );
    }
    const agent = await this.requireAgent(sourceRun.agentId);
    if (agent.model !== sourceRun.runtime) {
      throw new DomainError(
        "SESSION_RUNTIME_CHANGED",
        "Reconnect the runtime used by the selected session",
        409,
      );
    }
    return this.continueRun(task, {
      agentId: agent.id,
      sessionRun: sourceRun,
      prompt: request,
      request,
      resumedFromRunId: sourceRun.id,
      attachmentIds,
    });
  }

  /** 담당 동료의 기존 세션(주어진 run, 없으면 기안서의 마지막 run)을 이어 run을 예약 */
  private async continueRun(
    task: Task,
    input: {
      agentId: string;
      sessionRun?: AgentRun;
      prompt: string;
      request: string;
    } & RunReservationOptions,
  ): Promise<AgentRun> {
    const { agentId, sessionRun, prompt, request, ...reservation } = input;
    const agent = await this.requireAgent(agentId);
    const reminder = task.resultFormat ? resultFormatSection(task.resultFormat) : "";
    const session = sessionRun ?? (await this.repository.latestRun(task.id));
    return this.queueRun({
      task,
      agent,
      prompt: reminder ? `${prompt}\n\n${reminder}` : prompt,
      request,
      resumeThreadId: session?.runtimeThreadId,
      ...reservation,
    });
  }

  async resolveApproval(
    runId: string,
    requestId: string,
    decision: ApprovalDecision,
  ): Promise<AgentRun> {
    const run = await this.repository.getRun(runId);
    if (!run) throw new DomainError("NOT_FOUND", `AgentRun not found: ${runId}`, 404);
    if (run.status !== "waiting") {
      throw new DomainError("RUN_NOT_WAITING", "Run is not waiting for approval", 409);
    }
    if (!this.runtime.resolveApproval(runId, requestId, decision)) {
      throw new DomainError("APPROVAL_NOT_FOUND", "Approval request is no longer pending", 404);
    }
    const updatedRun = await this.repository.updateRun(runId, { status: "running" });
    this.touchRun(runId);
    const task = await this.repository.getTask(run.taskId);
    if (task?.status === "needs_input") {
      const updatedTask = await this.repository.transitionTask(task.id, "working");
      this.publishTask(updatedTask);
    }
    if (task) {
      await this.activity(
        task,
        "approval_resolved",
        `Runtime approval resolved: ${decision}`,
        runId,
        {
          requestId,
          decision,
        },
      );
    }
    this.publishRun(updatedRun, task?.workspaceId);
    return updatedRun;
  }

  async cancelRun(runId: string): Promise<AgentRun> {
    const run = await this.repository.getRun(runId);
    if (!run) throw new DomainError("NOT_FOUND", `AgentRun not found: ${runId}`, 404);
    const active = this.activeRuns.get(runId);
    if (!active) {
      throw new DomainError("RUN_NOT_ACTIVE", "Run is no longer active", 409);
    }
    active.cancelRequested = true;
    active.abortPreparation?.();
    this.runtime.cancel(runId);
    return run;
  }

  private async requireSkills(agent: Agent): Promise<Skill[]> {
    return this.skillsFor(agent.skillIds);
  }

  private skillsFor(skillIds: string[]): Skill[] {
    if (skillIds.length === 0) return [];
    if (!this.skillLibrary) {
      throw new DomainError("SKILLS_NOT_FOUND", `Skill not found: ${skillIds[0]}`, 422);
    }
    return this.skillLibrary.require(skillIds);
  }

  private async queueRun(input: RunRequest): Promise<AgentRun> {
    const {
      task,
      agent,
      prompt,
      resumeThreadId,
      sessionBudget,
      request = task.description?.trim() || task.title,
      ...reservationOptions
    } = input;
    if (this.lifecycle.isApproving(task.id)) {
      throw new DomainError(
        "TASK_APPROVING",
        "결재를 프로젝트 폴더에 반영하는 중이에요. 잠시 뒤 다시 시도해 주세요.",
        409,
      );
    }
    const executionScope = await this.scopes.resolve(task);
    const modelSelection = selectModel(agent, task);
    const existingRuns = await this.repository.listRuns(task.id);
    const previousRun = existingRuns[0];
    assertMatchingExecutionScope(previousRun, executionScope);
    const runId = randomUUID();
    const modifiesFiles = task.modifiesFiles !== false;
    const attachmentIds = reservationOptions.attachmentIds ?? [];
    const attachments = attachmentIds.length
      ? this.repository
          .listAttachmentsByIds(attachmentIds)
          .filter((attachment) => attachment.taskId === task.id && !attachment.runId)
      : [];
    if (attachments.length !== new Set(attachmentIds).size) {
      throw new DomainError(
        "ATTACHMENT_NOT_AVAILABLE",
        "첨부 파일이 이 작업에 속하지 않거나 이미 다른 실행에 사용되었습니다",
        409,
      );
    }
    const promptWithAttachments = attachments.length
      ? `${prompt}\n\n${describeAttachments(attachments)}`
      : prompt;
    const activities: Array<Parameters<Repository["createActivity"]>[0]> = [
      ...(reservationOptions.activities ?? []),
      {
        workspaceId: task.workspaceId,
        type: "task_started",
        taskId: task.id,
        agentId: agent.id,
        runId,
        message: `Task assigned to ${agent.name}`,
      },
    ];
    const reserved = await this.repository.reserveRun(
      {
        id: runId,
        taskId: task.id,
        agentId: agent.id,
        runtime: agent.model,
        modelPolicy: modelSelection.policy,
        modelName: modelSelection.modelName,
        reasoningEffort: modelSelection.reasoningEffort,
        resumedFromRunId: reservationOptions.resumedFromRunId,
        request,
        scopeType: executionScope.type,
        scopeProjectId: executionScope.projectId,
        workingDirectory: executionScope.workingDirectory,
        cleanupPolicy: "preserve",
      },
      {
        expectedTaskStatus: reservationOptions.expectedTaskStatus ?? task.status,
        expectedProjectPath: executionScope.projectPath,
        expectedAssigneeAgentId:
          "expectedAssigneeAgentId" in reservationOptions
            ? reservationOptions.expectedAssigneeAgentId
            : task.assigneeAgentId,
        concurrencyLimit: this.concurrentRunLimit,
        modifiesFiles,
        ...(executionScope.type === "project" && !executionScope.workspace && modifiesFiles
          ? { exclusiveProjectDirectory: executionScope.workingDirectory }
          : {}),
        assigneeAgentId: agent.id,
        review: reservationOptions.review,
        activities,
        attachmentIds: attachments.map((attachment) => attachment.id),
      },
    );
    const { run, task: updatedTask } = reserved;
    this.publishTask(updatedTask);
    this.publishRun(run, task.workspaceId);
    for (const activity of reserved.activities) this.publishActivity(activity);
    this.activeRuns.set(run.id, {
      workspaceId: task.workspaceId,
      taskId: task.id,
      workingDirectory: executionScope.workingDirectory,
      ...(sessionBudget ? { sessionBudget } : {}),
      ...(attachments.length ? { attachments } : {}),
      ...(reservationOptions.verificationRetry ? { verificationRetry: true } : {}),
      ...(task.resultFormat ? { resultReporting: true } : {}),
      ...(executionScope.workspace && executionScope.project
        ? {
            workspace: {
              address: executionScope.workspace,
              project: executionScope.project,
              prepare: modifiesFiles,
            },
          }
        : {}),
    });
    queueMicrotask(() => {
      this.executeRun(run, agent, promptWithAttachments, resumeThreadId).catch((error: unknown) => {
        console.error(`Unhandled failure while executing run ${run.id}`, error);
      });
    });
    return run;
  }

  private async withReferenceDocuments(prompt: string, task: Task): Promise<string> {
    if (!this.knowledgeDocuments) return prompt;
    const documents = (await this.knowledgeDocuments.list(task.workspaceId)).filter(
      (document) => document.taskId === task.id || document.referenceTaskIds.includes(task.id),
    );
    return withReferenceDocumentsPrompt(prompt, documents);
  }

  private async executeRun(
    run: AgentRun,
    agent: Agent,
    prompt: string,
    resumeThreadId?: string,
  ): Promise<void> {
    let result: Awaited<ReturnType<RuntimeAdapter["run"]>> | undefined;
    try {
      const started = await this.repository.updateRun(run.id, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
      this.publishRun(started, this.activeRuns.get(run.id)?.workspaceId);
      await this.readyRequestWorkspace(run.id);
      const skills = this.skillLibrary?.prepareRun(run.id, agent.skillIds);
      const execution = this.runtime.run(
        {
          runId: run.id,
          runtime: agent.model,
          modelName: run.modelName,
          reasoningEffort: run.reasoningEffort,
          prompt,
          cwd:
            this.activeRuns.get(run.id)?.workingDirectory ??
            run.workingDirectory ??
            this.generalWorkingDirectory,
          resumeThreadId,
          writable: agent.permissions.fileWrite === true,
          browser: agent.permissions.browser === true,
          figma: agent.permissions.figma === true,
          conversational: agent.mode === "chat",
          limits: this.limits,
          attachments: this.activeRuns.get(run.id)?.attachments,
          ...(skills ? { skills } : {}),
          ...(this.activeRuns.get(run.id)?.resultReporting ? { resultReporting: true } : {}),
        },
        {
          // `RuntimeCallbacks.onEvent` is a fixed synchronous-void contract (see runtime.ts).
          // `handleRuntimeEvent` now awaits repository calls, so each event is queued onto a
          // per-run promise chain (see `queueRuntimeEvent`) to preserve emission order, and that
          // chain is drained via `flushRuntimeEvents` before this run's terminal status is
          // written below — otherwise a delayed "started" write could race past and overwrite a
          // "completed"/"failed" write that already landed.
          onEvent: (event) => {
            this.queueRuntimeEvent(run.id, event);
          },
          onApprovalPending: () => undefined,
        },
      );
      this.armRunTimers(run.id);
      if (this.activeRuns.get(run.id)?.cancelRequested) this.runtime.cancel(run.id);
      result = await execution;
      await this.flushRuntimeEvents(run.id);

      const active = this.activeRuns.get(run.id);
      if (active?.limitReason) {
        await this.finishSessionPaused(
          run.id,
          active.limitReason,
          result.eventLogRef,
          result.threadId,
        );
        return;
      }
      const cancelled = result.events.some((event) => event.type === "cancelled");
      if (cancelled) {
        await this.finishCancelled(run.id, result.eventLogRef, result.threadId);
        return;
      }
      const failed = result.events.findLast((event) => event.type === "failed");
      if (failed?.type === "failed") {
        await this.finishFailed(run.id, failed.error, result.eventLogRef, result.threadId);
        return;
      }
      const completion = result.events.findLast((event) => event.type === "completed");
      if (completion?.type !== "completed") {
        await this.finishFailed(
          run.id,
          "Runtime ended without a completion result",
          result.eventLogRef,
          result.threadId,
        );
        return;
      }
      const artifacts = result.events
        .filter((event) => event.type === "artifact_created")
        .map((event) => (event.type === "artifact_created" ? event.artifact : undefined))
        .filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== undefined);
      await this.finishCompleted(
        run.id,
        { summary: completion.result.summary, ...(artifacts.length > 0 ? { artifacts } : {}) },
        collectRunFacts(result.events, completion.result.summary),
        result.eventLogRef,
        result.threadId,
      );
    } catch (error) {
      await this.flushRuntimeEvents(run.id);
      const limitReason = this.activeRuns.get(run.id)?.limitReason;
      if (limitReason) {
        await this.finishSessionPaused(run.id, limitReason, result?.eventLogRef, result?.threadId);
      } else {
        await this.finishFailed(
          run.id,
          error instanceof Error ? error.message : String(error),
          result?.eventLogRef,
          result?.threadId,
        );
      }
    } finally {
      this.clearRunTimers(run.id);
      this.activeRuns.delete(run.id);
      this.eventQueues.delete(run.id);
      this.skillLibrary?.releaseRun(run.id);
    }
  }

  private queueRuntimeEvent(runId: string, event: AgentEvent): void {
    const previous = this.eventQueues.get(runId) ?? Promise.resolve();
    const next = previous.then(() => this.handleRuntimeEvent(runId, event));
    this.eventQueues.set(
      runId,
      next.catch((error: unknown) => {
        console.error("Failed to handle runtime event", error);
      }),
    );
  }

  private async flushRuntimeEvents(runId: string): Promise<void> {
    await (this.eventQueues.get(runId) ?? Promise.resolve());
  }

  private async handleRuntimeEvent(runId: string, event: AgentEvent): Promise<void> {
    const run = await this.repository.getRun(runId);
    if (!run) return;
    const task = await this.repository.getTask(run.taskId);
    if (!task) return;
    this.touchRun(runId);

    const progressInput = runtimeProgress(run.runtime, event);
    if (progressInput) {
      const progress = await this.repository.createRunProgress({ runId, ...progressInput });
      this.events.publish({
        type: "run.progress",
        workspaceId: task.workspaceId,
        data: { runId, taskId: task.id, progress },
      });
    }

    if (event.type === "started") {
      const updated = await this.repository.updateRun(runId, {
        status: "running",
        runtimeThreadId: event.threadId,
      });
      this.publishRun(updated, task.workspaceId);
    } else if (event.type === "permission_requested") {
      this.pauseIdleTimer(runId);
      const updatedRun = await this.repository.updateRun(runId, { status: "waiting" });
      const updatedTask =
        task.status === "working"
          ? await this.repository.transitionTask(task.id, "needs_input")
          : task;
      await this.activity(
        updatedTask,
        "approval_requested",
        `Runtime permission requested: ${event.permission}`,
        runId,
        {
          requestId: String(event.requestId),
          permission: event.permission,
          details: event.details,
        },
      );
      this.events.publish({
        type: "approval.requested",
        workspaceId: task.workspaceId,
        data: {
          runId,
          requestId: String(event.requestId),
          permission: event.permission,
          details: event.details ?? {},
        },
      });
      this.publishRun(updatedRun, task.workspaceId);
      this.publishTask(updatedTask);
    } else if (event.type === "usage_updated") {
      const updated = await this.repository.updateRun(runId, { usage: event.usage });
      this.publishRun(updated, task.workspaceId);
      const total = (event.usage.inputTokens ?? 0) + (event.usage.outputTokens ?? 0);
      const active = this.activeRuns.get(runId);
      const maxTokens = active?.sessionBudget?.maxAdditionalTokens ?? this.limits.maxTokens;
      const measuredUsage = active?.sessionBudget
        ? total >= active.sessionBudget.usageBaselineTokens
          ? total - active.sessionBudget.usageBaselineTokens
          : total
        : total;
      if (
        maxTokens !== undefined &&
        measuredUsage >= maxTokens * 0.8 &&
        active &&
        !active.sessionWarningEmitted
      ) {
        active.sessionWarningEmitted = true;
        const progress = await this.repository.createRunProgress({
          runId,
          type: "message",
          message: "작업 세션 한도가 얼마 남지 않았습니다. 지금 하던 일을 마무리하는 중입니다.",
          metadata: { kind: "session_limit_warning" },
        });
        await this.activity(
          task,
          "session_limit_warning",
          "작업 세션 한도가 얼마 남지 않았습니다.",
          runId,
        );
        this.events.publish({
          type: "run.progress",
          workspaceId: task.workspaceId,
          data: { runId, taskId: task.id, progress },
        });
        this.events.publish({
          type: "session.limit_warning",
          workspaceId: task.workspaceId,
          data: { task, runId },
        });
      }
      if (maxTokens !== undefined && measuredUsage >= maxTokens) {
        if (active && !active.limitReason) {
          active.limitReason = "capacity";
          this.runtime.cancel(runId);
        }
      }
    }
  }

  private async finishCompleted(
    runId: string,
    result: TaskResult,
    facts: RunFacts,
    eventLogRef?: string,
    threadId?: string,
  ): Promise<void> {
    const run = await this.repository.getRun(runId);
    if (!run) return;
    const task = await this.repository.getTask(run.taskId);
    if (!task) return;
    if (task.status === "needs_input") await this.repository.transitionTask(task.id, "working");
    const project = task.projectId ? await this.repository.getProject(task.projectId) : undefined;
    const verifications = verificationFacts(facts.commands, project?.verificationCommands ?? []);
    const runResult: TaskResult = {
      ...result,
      metadata: {
        ...result.metadata,
        ...(verifications.length > 0 ? { verifications } : {}),
        ...(facts.reportedResult !== undefined ? { reportedResult: facts.reportedResult } : {}),
        ...(facts.changedPaths.length > 0 ? { changedPaths: facts.changedPaths } : {}),
      },
    };
    const updatedRun = await this.repository.updateRun(runId, {
      status: "completed",
      finishedAt: new Date().toISOString(),
      eventLogRef,
      runtimeThreadId: threadId,
      result: runResult,
    });
    this.publishRun(updatedRun, task.workspaceId);
    const decision = decideAfterRun({
      contract: checkOutputContract(task.resultFormat, facts.reportedResult),
      verifications,
      verificationRetryUsed: this.activeRuns.get(runId)?.verificationRetry === true,
      hasFileChanges: await this.lifecycle.hasFileChanges(task, project, facts),
      reviewRequired: task.reviewBeforeNext === true,
    });
    await this.lifecycle.applyRunDecision(decision, { task, run: updatedRun, result: runResult });
  }

  private async finishCancelled(
    runId: string,
    eventLogRef?: string,
    threadId?: string,
  ): Promise<void> {
    const run = await this.repository.getRun(runId);
    if (!run) return;
    const task = await this.repository.getTask(run.taskId);
    if (!task) return;
    const updatedRun = await this.repository.updateRun(runId, {
      status: "cancelled",
      finishedAt: new Date().toISOString(),
      eventLogRef,
      runtimeThreadId: threadId,
    });
    const updatedTask = await this.repository.transitionTask(task.id, "todo");
    await this.activity(
      updatedTask,
      "task_cancelled",
      "Run cancelled; partial artifacts were preserved",
      runId,
    );
    this.publishRun(updatedRun, task.workspaceId);
    this.publishTask(updatedTask);
  }

  private async finishFailed(
    runId: string,
    error: string,
    eventLogRef?: string,
    threadId?: string,
  ): Promise<void> {
    const run = await this.repository.getRun(runId);
    if (!run) return;
    const task = await this.repository.getTask(run.taskId);
    if (!task) return;
    const updatedRun = await this.repository.updateRun(runId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      eventLogRef,
      runtimeThreadId: threadId,
      error,
    });
    const updatedTask =
      task.status === "failed" ? task : await this.repository.transitionTask(task.id, "failed");
    await this.activity(updatedTask, "task_failed", error, runId);
    this.publishRun(updatedRun, task.workspaceId);
    this.publishTask(updatedTask);
  }

  private async finishSessionPaused(
    runId: string,
    reason: "capacity" | "inactivity" | "duration",
    eventLogRef?: string,
    threadId?: string,
  ): Promise<void> {
    const run = await this.repository.getRun(runId);
    if (!run || run.status === "failed") return;
    const task = await this.repository.getTask(run.taskId);
    if (!task) return;
    const minutes = (ms: number | undefined) => Math.round((ms ?? 0) / 60_000);
    const messages = {
      capacity: "작업 세션 한도에 도달했습니다.",
      inactivity: `${minutes(this.limits.idleTimeoutMs)}분 동안 새 진행이 없어 작업 세션을 일시 중단했습니다.`,
      duration: `${minutes(this.limits.maxDurationMs)}분 실행 한도에 도달해 작업 세션을 일시 중단했습니다.`,
    } as const;
    const updatedRun = await this.repository.updateRun(runId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      eventLogRef,
      runtimeThreadId: threadId,
      error: `SESSION_LIMIT:${reason}:${messages[reason]}`,
    });
    const updatedTask =
      task.status === "needs_input"
        ? task
        : await this.repository.transitionTask(task.id, "needs_input");
    await this.activity(updatedTask, "session_limit_reached", messages[reason], runId, { reason });
    this.publishRun(updatedRun, task.workspaceId);
    this.publishTask(updatedTask);
    this.events.publish({
      type: "session.limit_reached",
      workspaceId: task.workspaceId,
      data: { task: updatedTask, runId, reason },
    });
  }

  private async requireRunnableTask(taskId: string, status: Task["status"]): Promise<Task> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== status) {
      throw new DomainError("TASK_NOT_RUNNABLE", `Task must be ${status} to run`, 409);
    }
    return task;
  }

  private async requireRuntimeAgent(task: Task): Promise<Agent> {
    if (!task.assigneeAgentId)
      throw new DomainError("TASK_UNASSIGNED", "Task has no assigned agent", 422);
    return this.requireAgent(task.assigneeAgentId);
  }

  private async requireAgent(agentId: string): Promise<Agent> {
    const agent = await this.repository.getAgent(agentId);
    if (!agent) throw new DomainError("NOT_FOUND", `Agent not found: ${agentId}`, 404);
    if (
      agent.mode !== "chat" &&
      (agent.permissions.fileRead !== true || agent.permissions.terminal !== true)
    ) {
      throw new DomainError(
        "RUNTIME_PERMISSION_PROFILE_UNSUPPORTED",
        `The ${agent.model} adapter requires explicit fileRead and terminal permissions`,
        422,
      );
    }
    return agent;
  }

  private async continuationContext(runId: string): Promise<string> {
    const progress = await this.repository.listRunProgress(runId);
    const recent = progress.slice(-12);
    if (recent.length === 0) {
      return "No concise progress events were recorded. Inspect the workspace state first.";
    }
    return recent
      .map((event) => `[${event.type}] ${event.message}`)
      .join("\n")
      .slice(-8_000);
  }

  private armRunTimers(runId: string): void {
    const active = this.activeRuns.get(runId);
    if (!active) return;
    active.hardTimer = setTimeout(
      () => {
        const current = this.activeRuns.get(runId);
        if (!current || current.limitReason) return;
        current.limitReason = "duration";
        this.runtime.cancel(runId);
      },
      Math.max(1, this.limits.maxDurationMs - 100),
    );
    this.touchRun(runId);
  }

  private touchRun(runId: string): void {
    const active = this.activeRuns.get(runId);
    const idleTimeoutMs = this.limits.idleTimeoutMs;
    if (!active || idleTimeoutMs === undefined) return;
    if (active.idleTimer) clearTimeout(active.idleTimer);
    active.idleTimer = setTimeout(() => {
      const current = this.activeRuns.get(runId);
      if (!current || current.limitReason) return;
      current.limitReason = "inactivity";
      this.runtime.cancel(runId);
    }, idleTimeoutMs);
  }

  private pauseIdleTimer(runId: string): void {
    const active = this.activeRuns.get(runId);
    if (!active?.idleTimer) return;
    clearTimeout(active.idleTimer);
    active.idleTimer = undefined;
  }

  private clearRunTimers(runId: string): void {
    const active = this.activeRuns.get(runId);
    if (!active) return;
    if (active.idleTimer) clearTimeout(active.idleTimer);
    if (active.hardTimer) clearTimeout(active.hardTimer);
  }

  /** run 전에 기안서 작업 공간을 만들고, 준비 명령까지 실행 (실패하면 run 실패) */
  /**
   * run 전에 기안서 작업 공간을 만들어 기록하고, 준비 명령까지 실행
   * 준비는 run 취소로 함께 멈추며, 실패하면 run 실패
   */
  private async readyRequestWorkspace(runId: string): Promise<void> {
    const active = this.activeRuns.get(runId);
    const workspace = active?.workspace;
    if (!active || !workspace || !this.requestWorkspaces) return;
    const ready = await this.requestWorkspaces.ensure(workspace.address);
    this.repository.saveRequestWorkspaceBinding({
      taskId: workspace.address.taskId,
      projectId: workspace.address.projectId,
      repositoryRoot: workspace.address.project.repositoryRoot,
      scope: workspace.address.project.scope,
    });
    if (!workspace.prepare) return;
    await this.recordProgress(runId, "작업 공간을 준비하고 있어요", "workspace_preparing");
    const abort = new AbortController();
    active.abortPreparation = () => abort.abort();
    try {
      const prepared = await this.requestWorkspaces.prepare(ready, workspace.project, abort.signal);
      if (prepared.status === "failed") {
        throw new Error(
          `작업 공간을 준비하지 못했어요 (${workspace.project.setupCommand ?? "준비"})\n${prepared.output}`,
        );
      }
    } finally {
      active.abortPreparation = undefined;
    }
  }

  private async recordProgress(runId: string, message: string, kind: string): Promise<void> {
    const active = this.activeRuns.get(runId);
    const progress = await this.repository.createRunProgress({
      runId,
      type: "message",
      message,
      metadata: { kind },
    });
    if (active)
      this.events.publish({
        type: "run.progress",
        workspaceId: active.workspaceId,
        data: { runId, taskId: active.taskId, progress },
      });
  }

  private async activity(
    task: Task,
    type: Parameters<Repository["createActivity"]>[0]["type"],
    message: string,
    runId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const activity = await this.repository.createActivity({
      workspaceId: task.workspaceId,
      type,
      taskId: task.id,
      agentId: task.assigneeAgentId,
      runId,
      message,
      metadata,
    });
    this.publishActivity(activity);
  }

  private publishActivity(activity: Awaited<ReturnType<Repository["createActivity"]>>): void {
    this.events.publish({
      type: "activity.created",
      workspaceId: activity.workspaceId,
      data: { activity },
    });
  }

  private publishTask(task: Task): void {
    this.events.publish({
      type: "task.status_changed",
      workspaceId: task.workspaceId,
      data: { task },
    });
    if (task.projectId && releasesProjectSlot(task)) void this.queue.resume(task.projectId);
    if (task.planId && task.status === "done") void this.startReadyPlanTasks(task.planId);
  }

  private publishRun(run: AgentRun, workspaceId?: string): void {
    if (!workspaceId) return;
    this.events.publish({ type: "agent.status_changed", workspaceId, data: { run } });
  }
}

function runtimeProgress(
  runtime: AgentRun["runtime"],
  event: AgentEvent,
): Omit<Parameters<Repository["createRunProgress"]>[0], "runId"> | undefined {
  if (event.type === "started") {
    return { type: "started", message: `${runtime.toUpperCase()} 실행을 시작했습니다.` };
  }
  if (event.type === "message") {
    return { type: "message", message: event.content };
  }
  if (event.type === "tool_started") {
    return {
      type: "tool_started",
      message: `${event.tool} 실행 중`,
      metadata: { tool: event.tool, ...(event.detail ? { detail: event.detail } : {}) },
    };
  }
  if (event.type === "tool_completed") {
    return {
      type: "tool_completed",
      message: `${event.tool} ${event.status === "failed" ? "실패" : "완료"}`,
      metadata: { tool: event.tool, status: event.status ?? "completed" },
    };
  }
  if (event.type === "permission_requested") {
    return {
      type: "permission_requested",
      message: `${event.permission} 권한 승인을 기다리고 있습니다.`,
      metadata: { requestId: String(event.requestId), permission: event.permission },
    };
  }
  return undefined;
}

function runUsageTokens(run: AgentRun): number {
  return (run.usage?.inputTokens ?? 0) + (run.usage?.outputTokens ?? 0);
}
