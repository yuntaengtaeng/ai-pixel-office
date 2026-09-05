import { randomUUID } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  compileAgentInstructions,
  DomainError,
  type Agent,
  type AgentRun,
  type ExecutionScopeType,
  type RunLimits,
  type Task,
  type TaskResult,
  type TaskWorkflowStep,
} from "@ai-pixel-office/domain";
import type { AgentEvent, ApprovalDecision } from "@ai-pixel-office/runtime-protocol";
import { EventBus } from "./events.ts";
import { Repository } from "./repository/index.ts";
import type { RuntimeAdapter } from "./runtime/index.ts";
import { selectModel } from "./model-routing.ts";
import { inspectProjectRuntimeContext, type ProjectRuntimeContext } from "./project-context.ts";

type ActiveRunContext = {
  workspaceId: string;
  taskId: string;
  limitReason?: "capacity" | "inactivity" | "duration";
  sessionWarningEmitted?: boolean;
  idleTimer?: NodeJS.Timeout;
  hardTimer?: NodeJS.Timeout;
  cancelRequested?: boolean;
  workingDirectory: string;
  workflowStepId?: string;
  sessionBudget?: SessionBudget;
};

type SessionBudget = {
  usageBaselineTokens: number;
  maxAdditionalTokens: number;
};

type WorkflowContinuation = {
  context: string;
  resumeThreadId?: string;
  sessionBudget?: SessionBudget;
  sameSession?: boolean;
};

type RunReservationOptions = {
  expectedTaskStatus?: Task["status"];
  expectedAssigneeAgentId?: string;
  resetFailedWorkflowStep?: boolean;
  review?: Parameters<Repository["createReview"]>[0];
  activities?: Array<Parameters<Repository["createActivity"]>[0]>;
};

export type OrchestratorOptions = {
  generalWorkingDirectory: string;
  concurrentRunLimit?: number;
  defaultRunLimits?: RunLimits;
};

export type TaskExecutionContext = ProjectRuntimeContext & {
  agentId: string;
  agentName: string;
  workflowStepId?: string;
  position?: number;
};

export class Orchestrator {
  private readonly repository: Repository;
  private readonly runtime: RuntimeAdapter;
  private readonly events: EventBus;
  private readonly generalWorkingDirectory: string;
  private readonly concurrentRunLimit: number;
  private readonly limits: RunLimits;
  private readonly activeRuns = new Map<string, ActiveRunContext>();
  private readonly eventQueues = new Map<string, Promise<void>>();

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
    this.limits = options.defaultRunLimits ?? {
      maxDurationMs: 20 * 60_000,
      idleTimeoutMs: 5 * 60_000,
      maxTurns: 100,
      maxTokens: 100_000,
    };
  }

  async getTaskExecutionContexts(taskId: string): Promise<TaskExecutionContext[]> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    const contextAgent = async (agentId: string): Promise<Agent> => {
      const agent = await this.repository.getAgent(agentId);
      if (!agent) throw new DomainError("NOT_FOUND", `Agent not found: ${agentId}`, 404);
      return agent;
    };
    const workflow = await this.repository.listWorkflowSteps(task.id);
    const assignments: Array<{ agent: Agent; workflowStepId?: string; position?: number }> = [];
    if (workflow.length > 0) {
      for (const step of workflow) {
        assignments.push({
          agent: await contextAgent(step.agentId),
          workflowStepId: step.id,
          position: step.position,
        });
      }
    } else if (task.assigneeAgentId) {
      assignments.push({ agent: await contextAgent(task.assigneeAgentId) });
    }

    const contexts: TaskExecutionContext[] = [];
    for (const { agent, ...assignment } of assignments) {
      const executionScope = await this.resolveExecutionScope(task);
      contexts.push({
        agentId: agent.id,
        agentName: agent.name,
        ...assignment,
        ...inspectProjectRuntimeContext(agent.model, executionScope.workingDirectory),
      });
    }
    return contexts;
  }

  async startTask(taskId: string): Promise<AgentRun> {
    const task = await this.requireRunnableTask(taskId, "todo");
    const workflow = await this.repository.listWorkflowSteps(taskId);
    if (workflow.length > 0) {
      const nextStep = workflow.find((step) => step.status === "pending");
      if (!nextStep) {
        throw new DomainError("WORKFLOW_COMPLETE", "실행할 Workflow 단계가 없습니다.", 409);
      }
      return this.startWorkflowStep(task, nextStep);
    }
    const agent = await this.requireRuntimeAgent(task);
    const skills = await this.requireSkills(agent);
    const prompt = compileAgentInstructions(agent, skills, task);
    return this.queueRun(task, agent, prompt);
  }

  async retryTask(taskId: string): Promise<AgentRun> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "failed") {
      throw new DomainError("TASK_NOT_FAILED", "Only a failed task can be retried", 409);
    }
    await this.assertExecutionScopeUnchanged(task, await this.repository.latestRun(task.id));
    const workflow = await this.repository.listWorkflowSteps(taskId);
    if (workflow.length > 0) {
      const failedStep = workflow.find((step) => step.status === "failed");
      if (!failedStep) {
        throw new DomainError("WORKFLOW_NOT_FAILED", "실패한 Workflow 단계가 없습니다.", 409);
      }
      return this.startWorkflowStep(task, failedStep, undefined, {
        expectedTaskStatus: "failed",
        resetFailedWorkflowStep: true,
      });
    }
    const agent = await this.requireRuntimeAgent(task);
    const skills = await this.requireSkills(agent);
    const prompt = compileAgentInstructions(agent, skills, task);
    return this.queueRun(task, agent, prompt, undefined, undefined, undefined, undefined, {
      expectedTaskStatus: "failed",
    });
  }

  async approveTask(taskId: string): Promise<Task> {
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
    await this.repository.createReview({ taskId, runId: latestRun?.id, action: "approved" });
    const updated = await this.repository.transitionTask(taskId, "done");
    await this.activity(updated, "task_approved", "Task result approved", latestRun?.id);
    this.publishTask(updated);
    return updated;
  }

  async requestChanges(taskId: string, feedback: string): Promise<AgentRun> {
    if (!feedback.trim()) throw new DomainError("INVALID_FEEDBACK", "Feedback is required");
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_review") {
      throw new DomainError(
        "TASK_NOT_REVIEWABLE",
        "Only a task awaiting review can request changes",
        409,
      );
    }
    const agent = await this.requireRuntimeAgent(task);
    const previousRun = await this.repository.latestRun(task.id);
    await this.assertExecutionScopeUnchanged(task, previousRun);
    const run = await this.queueRun(
      task,
      agent,
      `REVISION REQUEST\n${feedback.trim()}\n\nRevise your previous result for task: ${task.title}`,
      previousRun?.runtimeThreadId,
      undefined,
      undefined,
      feedback.trim(),
      {
        expectedTaskStatus: "needs_review",
        review: {
          taskId,
          runId: previousRun?.id,
          action: "changes_requested",
          feedback: feedback.trim(),
        },
        activities: [
          {
            workspaceId: task.workspaceId,
            type: "change_requested",
            taskId: task.id,
            agentId: task.assigneeAgentId,
            runId: previousRun?.id,
            message: `Changes requested: ${feedback.trim()}`,
          },
        ],
      },
    );
    return run;
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
    const workflow = await this.repository.listWorkflowSteps(task.id);
    if (workflow.length > 0) {
      const step = workflow.find((candidate) => candidate.status === "pending");
      if (!step) {
        throw new DomainError("WORKFLOW_COMPLETE", "이어갈 Workflow 단계가 없습니다.", 409);
      }
      return this.startWorkflowStep(task, step, { context });
    }
    const agent = await this.requireAgent(previousRun.agentId);
    const skills = await this.requireSkills(agent);
    const prompt = `${compileAgentInstructions(agent, skills, task)}\n\nNEW WORK SESSION CONTINUATION\nThe previous work session reached its safety limit. Partial workspace changes were preserved. Inspect the current workspace, use the concise progress record below, and continue without repeating completed work.\n\n${context}`;
    return this.queueRun(
      task,
      agent,
      prompt,
      undefined,
      undefined,
      undefined,
      "새 작업 세션에서 이어가기",
    );
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
    const workflow = await this.repository.listWorkflowSteps(task.id);
    if (workflow.length > 0) {
      const step = workflow.find((candidate) => candidate.status === "pending");
      if (!step) {
        throw new DomainError("WORKFLOW_COMPLETE", "이어갈 Workflow 단계가 없습니다.", 409);
      }
      return this.startWorkflowStep(task, step, {
        context,
        resumeThreadId: previousRun.runtimeThreadId,
        sessionBudget,
        sameSession: true,
      });
    }
    const agent = await this.requireAgent(previousRun.agentId);
    const prompt = `SAME WORK SESSION CONTINUATION\nThe application session allowance has been increased. Continue in the existing runtime session without repeating completed work. Use the concise progress record below only as a reminder.\n\n${context}`;
    return this.queueRun(
      task,
      agent,
      prompt,
      previousRun.runtimeThreadId,
      undefined,
      sessionBudget,
      "같은 작업 세션의 한도를 늘려 계속",
    );
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
    this.runtime.cancel(runId);
    return run;
  }

  private async requireSkills(agent: Agent) {
    const skills = [];
    for (const id of agent.skillIds) {
      const skill = await this.repository.getSkill(id);
      if (!skill) throw new DomainError("SKILLS_NOT_FOUND", `Skill not found: ${id}`, 422);
      skills.push(skill);
    }
    return skills;
  }

  private async queueRun(
    task: Task,
    agent: Agent,
    prompt: string,
    resumeThreadId?: string,
    workflowStep?: TaskWorkflowStep,
    sessionBudget?: SessionBudget,
    request = task.description?.trim() || task.title,
    reservationOptions: RunReservationOptions = {},
  ): Promise<AgentRun> {
    const executionScope = await this.resolveExecutionScope(task);
    const modelSelection = selectModel(agent, task);
    const existingRuns = await this.repository.listRuns(task.id);
    const previousRun = existingRuns[0];
    this.assertMatchingExecutionScope(previousRun, executionScope);
    const runId = randomUUID();
    const activities: Array<Parameters<Repository["createActivity"]>[0]> = [
      ...(workflowStep
        ? [
            {
              workspaceId: task.workspaceId,
              type: "workflow_step_started" as const,
              taskId: task.id,
              agentId: agent.id,
              runId,
              message: `Workflow ${workflowStep.position + 1}단계 시작: ${agent.name}`,
              metadata: { workflowStepId: workflowStep.id, position: workflowStep.position },
            },
          ]
        : []),
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
        workflowStepId: workflowStep?.id,
        resetFailedWorkflowStep: reservationOptions.resetFailedWorkflowStep,
        assigneeAgentId: agent.id,
        review: reservationOptions.review,
        activities,
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
      ...(workflowStep ? { workflowStepId: workflowStep.id } : {}),
      ...(sessionBudget ? { sessionBudget } : {}),
    });
    queueMicrotask(() => {
      this.executeRun(run, agent, prompt, resumeThreadId).catch((error: unknown) => {
        console.error(`Unhandled failure while executing run ${run.id}`, error);
      });
    });
    return run;
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
          message: "작업 세션 한도가 얼마 남지 않았습니다. 현재 단계를 마무리하는 중입니다.",
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
    eventLogRef?: string,
    threadId?: string,
  ): Promise<void> {
    const run = await this.repository.getRun(runId);
    if (!run) return;
    const task = await this.repository.getTask(run.taskId);
    if (!task) return;
    if (task.status === "needs_input") await this.repository.transitionTask(task.id, "working");
    const updatedRun = await this.repository.updateRun(runId, {
      status: "completed",
      finishedAt: new Date().toISOString(),
      eventLogRef,
      runtimeThreadId: threadId,
      result,
    });
    const workflowStep = await this.repository.getWorkflowStepByRun(runId);
    if (workflowStep) {
      await this.repository.updateWorkflowStep(workflowStep.id, { status: "completed", result });
      const currentTask = (await this.repository.getTask(task.id)) ?? task;
      await this.activity(
        currentTask,
        "workflow_step_completed",
        `Workflow ${workflowStep.position + 1}단계 완료`,
        runId,
        { workflowStepId: workflowStep.id, position: workflowStep.position },
      );
      const steps = await this.repository.listWorkflowSteps(task.id);
      const nextStep = steps.find((step) => step.status === "pending");
      if (nextStep) {
        const updatedTask = await this.repository.transitionTask(task.id, "working", result);
        this.publishRun(updatedRun, task.workspaceId);
        this.publishTask(updatedTask);
        this.clearRunTimers(runId);
        this.activeRuns.delete(runId);
        try {
          await this.startWorkflowStep(updatedTask, nextStep);
        } catch (error) {
          const failedTask = await this.repository.transitionTask(task.id, "failed");
          await this.repository.updateWorkflowStep(nextStep.id, { status: "failed" });
          await this.activity(
            failedTask,
            "task_failed",
            error instanceof Error ? error.message : String(error),
          );
          this.publishTask(failedTask);
        }
        return;
      }
    }
    const updatedTask = await this.repository.transitionTask(task.id, "needs_review", result);
    await this.activity(updatedTask, "task_completed", "Task result is ready for review", runId);
    this.publishRun(updatedRun, task.workspaceId);
    this.publishTask(updatedTask);
    this.events.publish({
      type: "task.result_updated",
      workspaceId: task.workspaceId,
      data: { task: updatedTask },
    });
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
    const workflowStep = await this.repository.getWorkflowStepByRun(runId);
    if (workflowStep) {
      await this.repository.updateWorkflowStep(workflowStep.id, {
        status: "pending",
        runId: undefined,
      });
    }
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
    const workflowStep = await this.repository.getWorkflowStepByRun(runId);
    if (workflowStep)
      await this.repository.updateWorkflowStep(workflowStep.id, { status: "failed" });
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
    const messages = {
      capacity: "작업 세션 한도에 도달했습니다.",
      inactivity: "5분 동안 새 진행이 없어 작업 세션을 일시 중단했습니다.",
      duration: "20분 실행 한도에 도달해 작업 세션을 일시 중단했습니다.",
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
    const workflowStep = await this.repository.getWorkflowStepByRun(runId);
    if (workflowStep) {
      await this.repository.updateWorkflowStep(workflowStep.id, {
        status: "pending",
        runId: undefined,
      });
    }
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

  private async startWorkflowStep(
    task: Task,
    step: TaskWorkflowStep,
    continuation?: WorkflowContinuation,
    reservationOptions?: RunReservationOptions,
  ): Promise<AgentRun> {
    const agent = await this.requireAgent(step.agentId);
    const skills = await this.requireSkills(agent);
    const assignedTask = { ...task, assigneeAgentId: agent.id };
    const steps = await this.repository.listWorkflowSteps(task.id);
    const previousResults = steps
      .filter((candidate) => candidate.position < step.position && candidate.result)
      .map(
        (candidate) => `STEP ${candidate.position + 1} RESULT\n${candidate.result?.summary ?? ""}`,
      )
      .join("\n\n");
    const continuationLabel = continuation?.sameSession
      ? "SAME WORK SESSION CONTINUATION\nThe application session allowance has been increased. Continue in the existing runtime session without repeating completed work."
      : "NEW WORK SESSION CONTINUATION\nPartial workspace changes were preserved. Inspect them and continue without repeating completed work.";
    const prompt = `${compileAgentInstructions(agent, skills, assignedTask)}\n\nSEQUENTIAL WORKFLOW\nYou are step ${step.position + 1}. Use the previous agents' results as context and continue the same task.${previousResults ? `\n\n${previousResults}` : ""}${continuation ? `\n\n${continuationLabel}\n\n${continuation.context}` : ""}`;
    return this.queueRun(
      assignedTask,
      agent,
      prompt,
      continuation?.resumeThreadId,
      step,
      continuation?.sessionBudget,
      continuation
        ? continuation.sameSession
          ? "같은 작업 세션의 한도를 늘려 계속"
          : "새 작업 세션에서 이어가기"
        : assignedTask.description?.trim() || assignedTask.title,
      {
        ...reservationOptions,
        expectedAssigneeAgentId: task.assigneeAgentId,
      },
    );
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

  private async resolveExecutionScope(
    task: Task,
  ): Promise<{
    type: ExecutionScopeType;
    projectId?: string;
    projectPath?: string;
    workingDirectory: string;
  }> {
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
    const configuredDirectory = resolve(project?.path ?? this.generalWorkingDirectory);
    let directory: string;
    try {
      if (!statSync(configuredDirectory).isDirectory()) throw new Error("not a directory");
      directory = realpathSync.native(configuredDirectory);
    } catch {
      const scopeLabel = type === "project" ? "프로젝트" : "일반 대화";
      throw new DomainError(
        "WORKING_DIRECTORY_INVALID",
        `${scopeLabel} 폴더를 찾을 수 없습니다: ${configuredDirectory}`,
        422,
      );
    }
    return {
      type,
      projectId: project?.id,
      projectPath: project?.path,
      workingDirectory: directory,
    };
  }

  private async assertExecutionScopeUnchanged(
    task: Task,
    previousRun: AgentRun | undefined,
  ): Promise<void> {
    this.assertMatchingExecutionScope(previousRun, await this.resolveExecutionScope(task));
  }

  private assertMatchingExecutionScope(
    previousRun: AgentRun | undefined,
    executionScope: { type: ExecutionScopeType; projectId?: string; workingDirectory: string },
  ): void {
    if (
      previousRun &&
      (previousRun.scopeType !== executionScope.type ||
        previousRun.scopeProjectId !== executionScope.projectId ||
        previousRun.workingDirectory !== executionScope.workingDirectory)
    ) {
      throw new DomainError(
        "EXECUTION_SCOPE_CHANGED",
        "기존 세션의 프로젝트가 변경되어 이어서 실행할 수 없습니다",
        409,
      );
    }
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
