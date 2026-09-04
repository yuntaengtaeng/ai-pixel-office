import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import {
  compileAgentInstructions,
  DomainError,
  type Agent,
  type AgentRun,
  type RunLimits,
  type Task,
  type TaskResult,
  type TaskWorkflowStep,
} from "../../../packages/domain/src/index.ts";
import type { AgentEvent, ApprovalDecision } from "../../../scripts/runtime-spike/types.ts";
import { EventBus } from "./events.ts";
import { Repository } from "./repository.ts";
import type { RuntimeAdapter } from "./runtime.ts";
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

export type OrchestratorOptions = {
  workspacePath?: string;
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
  private readonly workspacePath: string;
  private readonly concurrentRunLimit: number;
  private readonly limits: RunLimits;
  private readonly activeRuns = new Map<string, ActiveRunContext>();

  constructor(
    repository: Repository,
    runtime: RuntimeAdapter,
    events: EventBus,
    options: OrchestratorOptions = {},
  ) {
    this.repository = repository;
    this.runtime = runtime;
    this.events = events;
    this.workspacePath = resolve(options.workspacePath ?? process.cwd());
    this.concurrentRunLimit = options.concurrentRunLimit ?? 2;
    this.limits = options.defaultRunLimits ?? {
      maxDurationMs: 20 * 60_000,
      idleTimeoutMs: 5 * 60_000,
      maxTurns: 100,
      maxTokens: 100_000,
    };
  }

  getTaskExecutionContexts(taskId: string): TaskExecutionContext[] {
    const task = this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    const contextAgent = (agentId: string) => {
      const agent = this.repository.getAgent(agentId);
      if (!agent) throw new DomainError("NOT_FOUND", `Agent not found: ${agentId}`, 404);
      return agent;
    };
    const workflow = this.repository.listWorkflowSteps(task.id);
    const assignments =
      workflow.length > 0
        ? workflow.map((step) => ({
            agent: contextAgent(step.agentId),
            workflowStepId: step.id,
            position: step.position,
          }))
        : task.assigneeAgentId
          ? [{ agent: contextAgent(task.assigneeAgentId) }]
          : [];

    return assignments.map(({ agent, ...assignment }) => ({
      agentId: agent.id,
      agentName: agent.name,
      ...assignment,
      ...inspectProjectRuntimeContext(agent.model, this.resolveWorkingDirectory(task, agent)),
    }));
  }

  startTask(taskId: string): AgentRun {
    const task = this.requireRunnableTask(taskId, "todo");
    const workflow = this.repository.listWorkflowSteps(taskId);
    if (workflow.length > 0) {
      const nextStep = workflow.find((step) => step.status === "pending");
      if (!nextStep) {
        throw new DomainError("WORKFLOW_COMPLETE", "실행할 Workflow 단계가 없습니다.", 409);
      }
      return this.startWorkflowStep(task, nextStep);
    }
    const agent = this.requireRuntimeAgent(task);
    const skills = agent.skillIds.map((id) => {
      const skill = this.repository.getSkill(id);
      if (!skill) throw new DomainError("SKILLS_NOT_FOUND", `Skill not found: ${id}`, 422);
      return skill;
    });
    const prompt = compileAgentInstructions(agent, skills, task);
    return this.queueRun(task, agent, prompt);
  }

  retryTask(taskId: string): AgentRun {
    const task = this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "failed") {
      throw new DomainError("TASK_NOT_FAILED", "Only a failed task can be retried", 409);
    }
    const workflow = this.repository.listWorkflowSteps(taskId);
    if (workflow.length > 0) {
      const failedStep = workflow.find((step) => step.status === "failed");
      if (!failedStep) {
        throw new DomainError("WORKFLOW_NOT_FAILED", "실패한 Workflow 단계가 없습니다.", 409);
      }
      this.requireAgent(failedStep.agentId);
      this.repository.resetFailedWorkflowStep(taskId);
    } else {
      this.requireRuntimeAgent(task);
    }
    const reset = this.repository.transitionTask(taskId, "todo");
    this.publishTask(reset);
    return this.startTask(taskId);
  }

  approveTask(taskId: string): Task {
    const task = this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_review") {
      throw new DomainError(
        "TASK_NOT_REVIEWABLE",
        "Only a task awaiting review can be approved",
        409,
      );
    }
    const latestRun = this.repository.latestRun(task.id);
    this.repository.createReview({ taskId, runId: latestRun?.id, action: "approved" });
    const updated = this.repository.transitionTask(taskId, "done");
    this.activity(updated, "task_approved", "Task result approved", latestRun?.id);
    this.publishTask(updated);
    return updated;
  }

  requestChanges(taskId: string, feedback: string): AgentRun {
    if (!feedback.trim()) throw new DomainError("INVALID_FEEDBACK", "Feedback is required");
    const task = this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_review") {
      throw new DomainError(
        "TASK_NOT_REVIEWABLE",
        "Only a task awaiting review can request changes",
        409,
      );
    }
    const agent = this.requireRuntimeAgent(task);
    const previousRun = this.repository.latestRun(task.id);
    this.repository.createReview({
      taskId,
      runId: previousRun?.id,
      action: "changes_requested",
      feedback: feedback.trim(),
    });
    this.activity(
      task,
      "change_requested",
      `Changes requested: ${feedback.trim()}`,
      previousRun?.id,
    );
    return this.queueRun(
      task,
      agent,
      `REVISION REQUEST\n${feedback.trim()}\n\nRevise your previous result for task: ${task.title}`,
      previousRun?.runtimeThreadId,
      undefined,
      undefined,
      feedback.trim(),
    );
  }

  continueTask(taskId: string): AgentRun {
    const task = this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_input") {
      throw new DomainError(
        "TASK_NOT_WAITING_FOR_SESSION",
        "작업 세션 한도로 일시 중단된 작업만 이어서 실행할 수 있습니다.",
        409,
      );
    }
    const previousRun = this.repository.latestRun(task.id);
    if (!previousRun?.error?.startsWith("SESSION_LIMIT:")) {
      throw new DomainError(
        "SESSION_CONTINUATION_NOT_AVAILABLE",
        "이 작업은 새 세션 이어하기 대상이 아닙니다.",
        409,
      );
    }
    const context = this.continuationContext(previousRun.id);
    const workflow = this.repository.listWorkflowSteps(task.id);
    if (workflow.length > 0) {
      const step = workflow.find((candidate) => candidate.status === "pending");
      if (!step) {
        throw new DomainError("WORKFLOW_COMPLETE", "이어갈 Workflow 단계가 없습니다.", 409);
      }
      return this.startWorkflowStep(task, step, { context });
    }
    const agent = this.requireAgent(previousRun.agentId);
    const skills = agent.skillIds.map((id) => {
      const skill = this.repository.getSkill(id);
      if (!skill) throw new DomainError("SKILLS_NOT_FOUND", `Skill not found: ${id}`, 422);
      return skill;
    });
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

  extendTaskSession(taskId: string): AgentRun {
    const task = this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== "needs_input") {
      throw new DomainError(
        "TASK_NOT_WAITING_FOR_SESSION",
        "작업 세션 한도로 일시 중단된 작업만 연장할 수 있습니다.",
        409,
      );
    }
    const previousRun = this.repository.latestRun(task.id);
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
    const context = this.continuationContext(previousRun.id);
    const sessionBudget: SessionBudget = {
      usageBaselineTokens: runUsageTokens(previousRun),
      maxAdditionalTokens: Math.max(1, Math.floor((this.limits.maxTokens ?? 100_000) / 2)),
    };
    const workflow = this.repository.listWorkflowSteps(task.id);
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
    const agent = this.requireAgent(previousRun.agentId);
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

  resolveApproval(runId: string, requestId: string, decision: ApprovalDecision): AgentRun {
    const run = this.repository.getRun(runId);
    if (!run) throw new DomainError("NOT_FOUND", `AgentRun not found: ${runId}`, 404);
    if (run.status !== "waiting") {
      throw new DomainError("RUN_NOT_WAITING", "Run is not waiting for approval", 409);
    }
    if (!this.runtime.resolveApproval(runId, requestId, decision)) {
      throw new DomainError("APPROVAL_NOT_FOUND", "Approval request is no longer pending", 404);
    }
    const updatedRun = this.repository.updateRun(runId, { status: "running" });
    this.touchRun(runId);
    const task = this.repository.getTask(run.taskId);
    if (task?.status === "needs_input") {
      const updatedTask = this.repository.transitionTask(task.id, "working");
      this.publishTask(updatedTask);
    }
    if (task) {
      this.activity(task, "approval_resolved", `Runtime approval resolved: ${decision}`, runId, {
        requestId,
        decision,
      });
    }
    this.publishRun(updatedRun, task?.workspaceId);
    return updatedRun;
  }

  cancelRun(runId: string): AgentRun {
    const run = this.repository.getRun(runId);
    if (!run) throw new DomainError("NOT_FOUND", `AgentRun not found: ${runId}`, 404);
    const active = this.activeRuns.get(runId);
    if (!active) {
      throw new DomainError("RUN_NOT_ACTIVE", "Run is no longer active", 409);
    }
    active.cancelRequested = true;
    this.runtime.cancel(runId);
    return run;
  }

  private queueRun(
    task: Task,
    agent: Agent,
    prompt: string,
    resumeThreadId?: string,
    workflowStep?: TaskWorkflowStep,
    sessionBudget?: SessionBudget,
    request = task.description?.trim() || task.title,
  ): AgentRun {
    const workingDirectory = this.resolveWorkingDirectory(task, agent);
    const modelSelection = selectModel(agent, task);
    const workspaceRuns = [...this.activeRuns.values()].filter(
      (active) => active.workspaceId === task.workspaceId,
    ).length;
    if (workspaceRuns >= this.concurrentRunLimit) {
      throw new DomainError("CONCURRENCY_LIMIT", "Workspace run concurrency limit reached", 429);
    }
    if (
      this.repository
        .listRuns(task.id)
        .some((run) => ["queued", "running", "waiting"].includes(run.status))
    ) {
      throw new DomainError("TASK_ALREADY_RUNNING", "Task already has an active run", 409);
    }
    const run = this.repository.createRun({
      id: randomUUID(),
      taskId: task.id,
      agentId: agent.id,
      runtime: agent.model,
      modelPolicy: modelSelection.policy,
      modelName: modelSelection.modelName,
      reasoningEffort: modelSelection.reasoningEffort,
      request,
      workingDirectory,
      cleanupPolicy: "preserve",
    });
    const updatedTask = this.repository.transitionTask(task.id, "working");
    if (workflowStep) {
      this.repository.updateWorkflowStep(workflowStep.id, {
        status: "working",
        runId: run.id,
      });
      this.activity(
        updatedTask,
        "workflow_step_started",
        `Workflow ${workflowStep.position + 1}단계 시작: ${agent.name}`,
        run.id,
        { workflowStepId: workflowStep.id, position: workflowStep.position },
      );
    }
    this.activity(updatedTask, "task_started", `Task assigned to ${agent.name}`, run.id);
    this.publishTask(updatedTask);
    this.publishRun(run, task.workspaceId);
    this.activeRuns.set(run.id, {
      workspaceId: task.workspaceId,
      taskId: task.id,
      workingDirectory,
      ...(workflowStep ? { workflowStepId: workflowStep.id } : {}),
      ...(sessionBudget ? { sessionBudget } : {}),
    });
    queueMicrotask(() => {
      void this.executeRun(run, agent, prompt, resumeThreadId);
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
      const started = this.repository.updateRun(run.id, {
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
          cwd: this.activeRuns.get(run.id)?.workingDirectory ?? this.workspacePath,
          resumeThreadId,
          writable: agent.permissions.fileWrite === true,
          browser: agent.permissions.browser === true,
          figma: agent.permissions.figma === true,
          conversational: agent.mode === "chat",
          limits: this.limits,
        },
        {
          onEvent: (event) => this.handleRuntimeEvent(run.id, event),
          onApprovalPending: () => undefined,
        },
      );
      this.armRunTimers(run.id);
      if (this.activeRuns.get(run.id)?.cancelRequested) this.runtime.cancel(run.id);
      result = await execution;

      const active = this.activeRuns.get(run.id);
      if (active?.limitReason) {
        this.finishSessionPaused(run.id, active.limitReason, result.eventLogRef, result.threadId);
        return;
      }
      const cancelled = result.events.some((event) => event.type === "cancelled");
      if (cancelled) {
        this.finishCancelled(run.id, result.eventLogRef, result.threadId);
        return;
      }
      const failed = result.events.findLast((event) => event.type === "failed");
      if (failed?.type === "failed") {
        this.finishFailed(run.id, failed.error, result.eventLogRef, result.threadId);
        return;
      }
      const completion = result.events.findLast((event) => event.type === "completed");
      if (completion?.type !== "completed") {
        this.finishFailed(
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
      this.finishCompleted(
        run.id,
        { summary: completion.result.summary, ...(artifacts.length > 0 ? { artifacts } : {}) },
        result.eventLogRef,
        result.threadId,
      );
    } catch (error) {
      const limitReason = this.activeRuns.get(run.id)?.limitReason;
      if (limitReason) {
        this.finishSessionPaused(run.id, limitReason, result?.eventLogRef, result?.threadId);
      } else {
        this.finishFailed(
          run.id,
          error instanceof Error ? error.message : String(error),
          result?.eventLogRef,
          result?.threadId,
        );
      }
    } finally {
      this.clearRunTimers(run.id);
      this.activeRuns.delete(run.id);
    }
  }

  private handleRuntimeEvent(runId: string, event: AgentEvent): void {
    const run = this.repository.getRun(runId);
    if (!run) return;
    const task = this.repository.getTask(run.taskId);
    if (!task) return;
    this.touchRun(runId);

    const progressInput = runtimeProgress(run.runtime, event);
    if (progressInput) {
      const progress = this.repository.createRunProgress({ runId, ...progressInput });
      this.events.publish({
        type: "run.progress",
        workspaceId: task.workspaceId,
        data: { runId, taskId: task.id, progress },
      });
    }

    if (event.type === "started") {
      const updated = this.repository.updateRun(runId, {
        status: "running",
        runtimeThreadId: event.threadId,
      });
      this.publishRun(updated, task.workspaceId);
    } else if (event.type === "permission_requested") {
      this.pauseIdleTimer(runId);
      const updatedRun = this.repository.updateRun(runId, { status: "waiting" });
      const updatedTask =
        task.status === "working" ? this.repository.transitionTask(task.id, "needs_input") : task;
      this.activity(
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
      const updated = this.repository.updateRun(runId, { usage: event.usage });
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
        const progress = this.repository.createRunProgress({
          runId,
          type: "message",
          message: "작업 세션 한도가 얼마 남지 않았습니다. 현재 단계를 마무리하는 중입니다.",
          metadata: { kind: "session_limit_warning" },
        });
        this.activity(
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

  private finishCompleted(
    runId: string,
    result: TaskResult,
    eventLogRef?: string,
    threadId?: string,
  ): void {
    const run = this.repository.getRun(runId);
    if (!run) return;
    const task = this.repository.getTask(run.taskId);
    if (!task) return;
    if (task.status === "needs_input") this.repository.transitionTask(task.id, "working");
    const updatedRun = this.repository.updateRun(runId, {
      status: "completed",
      finishedAt: new Date().toISOString(),
      eventLogRef,
      runtimeThreadId: threadId,
      result,
    });
    const workflowStep = this.repository.getWorkflowStepByRun(runId);
    if (workflowStep) {
      this.repository.updateWorkflowStep(workflowStep.id, { status: "completed", result });
      const currentTask = this.repository.getTask(task.id) ?? task;
      this.activity(
        currentTask,
        "workflow_step_completed",
        `Workflow ${workflowStep.position + 1}단계 완료`,
        runId,
        { workflowStepId: workflowStep.id, position: workflowStep.position },
      );
      const nextStep = this.repository
        .listWorkflowSteps(task.id)
        .find((step) => step.status === "pending");
      if (nextStep) {
        const updatedTask = this.repository.transitionTask(task.id, "working", result);
        this.publishRun(updatedRun, task.workspaceId);
        this.publishTask(updatedTask);
        this.clearRunTimers(runId);
        this.activeRuns.delete(runId);
        try {
          this.startWorkflowStep(updatedTask, nextStep);
        } catch (error) {
          const failedTask = this.repository.transitionTask(task.id, "failed");
          this.repository.updateWorkflowStep(nextStep.id, { status: "failed" });
          this.activity(
            failedTask,
            "task_failed",
            error instanceof Error ? error.message : String(error),
          );
          this.publishTask(failedTask);
        }
        return;
      }
    }
    const updatedTask = this.repository.transitionTask(task.id, "needs_review", result);
    this.activity(updatedTask, "task_completed", "Task result is ready for review", runId);
    this.publishRun(updatedRun, task.workspaceId);
    this.publishTask(updatedTask);
    this.events.publish({
      type: "task.result_updated",
      workspaceId: task.workspaceId,
      data: { task: updatedTask },
    });
  }

  private finishCancelled(runId: string, eventLogRef?: string, threadId?: string): void {
    const run = this.repository.getRun(runId);
    if (!run) return;
    const task = this.repository.getTask(run.taskId);
    if (!task) return;
    const updatedRun = this.repository.updateRun(runId, {
      status: "cancelled",
      finishedAt: new Date().toISOString(),
      eventLogRef,
      runtimeThreadId: threadId,
    });
    const updatedTask = this.repository.transitionTask(task.id, "todo");
    const workflowStep = this.repository.getWorkflowStepByRun(runId);
    if (workflowStep) {
      this.repository.updateWorkflowStep(workflowStep.id, { status: "pending", runId: undefined });
    }
    this.activity(
      updatedTask,
      "task_cancelled",
      "Run cancelled; partial artifacts were preserved",
      runId,
    );
    this.publishRun(updatedRun, task.workspaceId);
    this.publishTask(updatedTask);
  }

  private finishFailed(
    runId: string,
    error: string,
    eventLogRef?: string,
    threadId?: string,
  ): void {
    const run = this.repository.getRun(runId);
    if (!run) return;
    const task = this.repository.getTask(run.taskId);
    if (!task) return;
    const updatedRun = this.repository.updateRun(runId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      eventLogRef,
      runtimeThreadId: threadId,
      error,
    });
    const updatedTask =
      task.status === "failed" ? task : this.repository.transitionTask(task.id, "failed");
    const workflowStep = this.repository.getWorkflowStepByRun(runId);
    if (workflowStep) this.repository.updateWorkflowStep(workflowStep.id, { status: "failed" });
    this.activity(updatedTask, "task_failed", error, runId);
    this.publishRun(updatedRun, task.workspaceId);
    this.publishTask(updatedTask);
  }

  private finishSessionPaused(
    runId: string,
    reason: "capacity" | "inactivity" | "duration",
    eventLogRef?: string,
    threadId?: string,
  ): void {
    const run = this.repository.getRun(runId);
    if (!run || run.status === "failed") return;
    const task = this.repository.getTask(run.taskId);
    if (!task) return;
    const messages = {
      capacity: "작업 세션 한도에 도달했습니다.",
      inactivity: "5분 동안 새 진행이 없어 작업 세션을 일시 중단했습니다.",
      duration: "20분 실행 한도에 도달해 작업 세션을 일시 중단했습니다.",
    } as const;
    const updatedRun = this.repository.updateRun(runId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      eventLogRef,
      runtimeThreadId: threadId,
      error: `SESSION_LIMIT:${reason}:${messages[reason]}`,
    });
    const updatedTask =
      task.status === "needs_input" ? task : this.repository.transitionTask(task.id, "needs_input");
    const workflowStep = this.repository.getWorkflowStepByRun(runId);
    if (workflowStep) {
      this.repository.updateWorkflowStep(workflowStep.id, { status: "pending", runId: undefined });
    }
    this.activity(updatedTask, "session_limit_reached", messages[reason], runId, { reason });
    this.publishRun(updatedRun, task.workspaceId);
    this.publishTask(updatedTask);
    this.events.publish({
      type: "session.limit_reached",
      workspaceId: task.workspaceId,
      data: { task: updatedTask, runId, reason },
    });
  }

  private requireRunnableTask(taskId: string, status: Task["status"]): Task {
    const task = this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (task.status !== status) {
      throw new DomainError("TASK_NOT_RUNNABLE", `Task must be ${status} to run`, 409);
    }
    return task;
  }

  private requireRuntimeAgent(task: Task): Agent {
    if (!task.assigneeAgentId)
      throw new DomainError("TASK_UNASSIGNED", "Task has no assigned agent", 422);
    return this.requireAgent(task.assigneeAgentId);
  }

  private requireAgent(agentId: string): Agent {
    const agent = this.repository.getAgent(agentId);
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

  private startWorkflowStep(
    task: Task,
    step: TaskWorkflowStep,
    continuation?: WorkflowContinuation,
  ): AgentRun {
    const agent = this.requireAgent(step.agentId);
    const assignedTask = this.repository.updateTask(task.id, { assigneeAgentId: agent.id });
    const skills = agent.skillIds.map((id) => {
      const skill = this.repository.getSkill(id);
      if (!skill) throw new DomainError("SKILLS_NOT_FOUND", `Skill not found: ${id}`, 422);
      return skill;
    });
    const previousResults = this.repository
      .listWorkflowSteps(task.id)
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
    );
  }

  private continuationContext(runId: string): string {
    const recent = this.repository.listRunProgress(runId).slice(-12);
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

  private resolveWorkingDirectory(task: Task, agent: Agent): string {
    const workspace = this.repository.getWorkspace(task.workspaceId);
    const project = task.projectId ? this.repository.getProject(task.projectId) : undefined;
    const configured =
      task.workingDirectory ??
      project?.path ??
      agent.workingDirectory ??
      workspace?.workingDirectory;
    const directory = resolve(configured ?? this.workspacePath);
    try {
      if (!statSync(directory).isDirectory()) throw new Error("not a directory");
    } catch {
      throw new DomainError(
        "WORKING_DIRECTORY_INVALID",
        `프로젝트 폴더를 찾을 수 없습니다: ${directory}`,
        422,
      );
    }
    return directory;
  }

  private activity(
    task: Task,
    type: Parameters<Repository["createActivity"]>[0]["type"],
    message: string,
    runId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    const activity = this.repository.createActivity({
      workspaceId: task.workspaceId,
      type,
      taskId: task.id,
      agentId: task.assigneeAgentId,
      runId,
      message,
      metadata,
    });
    this.events.publish({
      type: "activity.created",
      workspaceId: task.workspaceId,
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
