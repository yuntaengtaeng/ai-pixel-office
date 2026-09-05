import { randomUUID } from "node:crypto";
import {
  assertTaskTransition,
  DomainError,
  type ActivityLog,
  type AgentRun,
  type RunProgressEvent,
  type Task,
  type TaskReview,
  type TaskStatus,
} from "@ai-pixel-office/domain";
import { requireEntity } from "../database.ts";
import type { AppDatabase } from "../database.ts";
import { json, now, optional, type Row, runFrom, workflowStepFrom } from "./rows.ts";
import { withTransaction } from "./shared.ts";
import { createActivitySync, type CreateActivityInput } from "./activities.ts";
import { getProjectSync } from "./projects.ts";
import { createReviewSync } from "./reviews.ts";
import { getTaskSync, transitionTaskSync, writeTask } from "./tasks.ts";
import { getWorkflowStepSync, updateWorkflowStepSync } from "./workflow.ts";

export type RunReservation = {
  expectedTaskStatus: TaskStatus;
  expectedProjectPath?: string;
  expectedAssigneeAgentId?: string;
  concurrencyLimit: number;
  workflowStepId?: string;
  resetFailedWorkflowStep?: boolean;
  assigneeAgentId?: string;
  review?: Omit<TaskReview, "id" | "createdAt">;
  activities: CreateActivityInput[];
};

type CreateRunInput = Pick<
  AgentRun,
  | "id"
  | "taskId"
  | "agentId"
  | "runtime"
  | "cleanupPolicy"
  | "modelPolicy"
  | "modelName"
  | "reasoningEffort"
  | "request"
  | "scopeType"
  | "scopeProjectId"
  | "workingDirectory"
>;

function createRunSync(database: AppDatabase, input: CreateRunInput): AgentRun {
  const run: AgentRun = { ...input, status: "queued", createdAt: now() };
  database
    .prepare(
      `INSERT INTO agent_runs
      (id, task_id, agent_id, runtime, model_policy, model_name, reasoning_effort, status,
       request_text, scope_type, scope_project_id, working_directory, cleanup_policy, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      run.id,
      run.taskId,
      run.agentId,
      run.runtime,
      run.modelPolicy ?? "default",
      run.modelName ?? null,
      run.reasoningEffort ?? null,
      run.status,
      run.request ?? null,
      run.scopeType,
      run.scopeProjectId ?? null,
      run.workingDirectory ?? null,
      run.cleanupPolicy,
      run.createdAt,
    );
  return run;
}

export async function createRun(database: AppDatabase, input: CreateRunInput): Promise<AgentRun> {
  return createRunSync(database, input);
}

export async function reserveRun(
  database: AppDatabase,
  input: CreateRunInput,
  reservation: RunReservation,
): Promise<{ run: AgentRun; task: Task; activities: ActivityLog[]; review?: TaskReview }> {
  return withTransaction(database, () => {
    const currentTask = requireEntity(getTaskSync(database, input.taskId), "Task", input.taskId);
    if (currentTask.status !== reservation.expectedTaskStatus) {
      throw new DomainError(
        "TASK_NOT_RUNNABLE",
        `Task must be ${reservation.expectedTaskStatus} to run`,
        409,
      );
    }
    if (currentTask.assigneeAgentId !== reservation.expectedAssigneeAgentId) {
      throw new DomainError(
        "TASK_ASSIGNMENT_CHANGED",
        "실행 예약 중 작업의 담당 Agent가 변경되었습니다",
        409,
      );
    }
    if (currentTask.projectId !== input.scopeProjectId) {
      throw new DomainError(
        "EXECUTION_SCOPE_CHANGED",
        "실행 예약 중 작업의 프로젝트가 변경되었습니다",
        409,
      );
    }
    if (input.scopeProjectId) {
      const project = requireEntity(
        getProjectSync(database, input.scopeProjectId),
        "Project",
        input.scopeProjectId,
      );
      if (
        project.workspaceId !== currentTask.workspaceId ||
        project.path !== reservation.expectedProjectPath
      ) {
        throw new DomainError(
          "EXECUTION_SCOPE_CHANGED",
          "실행 예약 중 프로젝트 폴더가 변경되었습니다",
          409,
        );
      }
    }
    const activeRun = database
      .prepare(
        "SELECT id FROM agent_runs WHERE task_id = ? AND status IN ('queued', 'running', 'waiting') LIMIT 1",
      )
      .get(input.taskId);
    if (activeRun) {
      throw new DomainError("TASK_ALREADY_RUNNING", "Task already has an active run", 409);
    }
    const workspaceRuns = database
      .prepare(
        `SELECT COUNT(*) AS count FROM agent_runs runs
        JOIN tasks ON tasks.id = runs.task_id
        WHERE tasks.workspace_id = ? AND runs.status IN ('queued', 'running', 'waiting')`,
      )
      .get(currentTask.workspaceId) as { count: number };
    if (workspaceRuns.count >= reservation.concurrencyLimit) {
      throw new DomainError("CONCURRENCY_LIMIT", "Workspace run concurrency limit reached", 429);
    }
    if (reservation.expectedTaskStatus === "failed") {
      assertTaskTransition("failed", "todo");
      assertTaskTransition("todo", "working");
    } else {
      assertTaskTransition(currentTask.status, "working");
    }
    const task: Task = {
      ...currentTask,
      status: "working",
      assigneeAgentId: reservation.assigneeAgentId ?? currentTask.assigneeAgentId,
      updatedAt: now(),
      completedAt: undefined,
    };
    writeTask(database, task);
    const run = createRunSync(database, input);
    if (reservation.workflowStepId) {
      const step = requireEntity(
        getWorkflowStepSync(database, reservation.workflowStepId),
        "WorkflowStep",
        reservation.workflowStepId,
      );
      if (step.taskId !== task.id) {
        throw new DomainError("WORKFLOW_STEP_MISMATCH", "Workflow step belongs to another task", 409);
      }
      const expectedStepStatus = reservation.resetFailedWorkflowStep ? "failed" : "pending";
      if (step.status !== expectedStepStatus) {
        throw new DomainError(
          reservation.resetFailedWorkflowStep ? "WORKFLOW_NOT_FAILED" : "WORKFLOW_STEP_NOT_PENDING",
          `Workflow step must be ${expectedStepStatus} to run`,
          409,
        );
      }
      updateWorkflowStepSync(database, reservation.workflowStepId, {
        status: "working",
        runId: run.id,
      });
    } else {
      const workflowStep = database
        .prepare("SELECT id FROM task_workflow_steps WHERE task_id = ? LIMIT 1")
        .get(task.id);
      if (workflowStep) {
        throw new DomainError("WORKFLOW_CHANGED", "실행 예약 중 Task Workflow가 변경되었습니다", 409);
      }
    }
    const review = reservation.review ? createReviewSync(database, reservation.review) : undefined;
    const activities = reservation.activities.map((activity) =>
      createActivitySync(database, activity),
    );
    return { run, task, activities, review };
  });
}

export async function getRun(database: AppDatabase, id: string): Promise<AgentRun | undefined> {
  const row = database.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id);
  return row ? runFrom(row as Row) : undefined;
}

function getRunSync(database: AppDatabase, id: string): AgentRun | undefined {
  const row = database.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id);
  return row ? runFrom(row as Row) : undefined;
}

export async function listRuns(database: AppDatabase, taskId?: string): Promise<AgentRun[]> {
  const rows = taskId
    ? database.prepare("SELECT * FROM agent_runs WHERE task_id = ? ORDER BY created_at DESC").all(taskId)
    : database.prepare("SELECT * FROM agent_runs ORDER BY created_at DESC").all();
  return rows.map((row) => runFrom(row as Row));
}

export async function createRunProgress(
  database: AppDatabase,
  input: Omit<RunProgressEvent, "id" | "createdAt">,
): Promise<RunProgressEvent> {
  requireEntity(await getRun(database, input.runId), "AgentRun", input.runId);
  const progress: RunProgressEvent = { id: randomUUID(), ...input, createdAt: now() };
  database
    .prepare(
      `INSERT INTO run_progress_events
      (id, run_id, type, message, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      progress.id,
      progress.runId,
      progress.type,
      progress.message.slice(0, 4_000),
      progress.metadata ? JSON.stringify(progress.metadata) : null,
      progress.createdAt,
    );
  return progress;
}

export async function listRunProgress(
  database: AppDatabase,
  runId: string,
  limit = 100,
): Promise<RunProgressEvent[]> {
  return database
    .prepare("SELECT * FROM run_progress_events WHERE run_id = ? ORDER BY created_at, rowid LIMIT ?")
    .all(runId, Math.min(Math.max(limit, 1), 300))
    .map((raw) => {
      const row = raw as Row;
      return {
        id: String(row.id),
        runId: String(row.run_id),
        type: row.type as RunProgressEvent["type"],
        message: String(row.message),
        metadata: json<Record<string, unknown> | undefined>(row.metadata_json, undefined),
        createdAt: String(row.created_at),
      };
    });
}

function updateRunSync(
  database: AppDatabase,
  id: string,
  patch: Partial<
    Pick<
      AgentRun,
      | "status"
      | "runtimeThreadId"
      | "startedAt"
      | "finishedAt"
      | "eventLogRef"
      | "usage"
      | "result"
      | "error"
    >
  >,
): AgentRun {
  const current = requireEntity(getRunSync(database, id), "AgentRun", id);
  const updated = { ...current, ...patch };
  database
    .prepare(
      `UPDATE agent_runs SET status = ?, runtime_thread_id = ?, started_at = ?,
      finished_at = ?, event_log_ref = ?, usage_json = ?, result_json = ?, error = ? WHERE id = ?`,
    )
    .run(
      updated.status,
      updated.runtimeThreadId ?? null,
      updated.startedAt ?? null,
      updated.finishedAt ?? null,
      updated.eventLogRef ?? null,
      updated.usage ? JSON.stringify(updated.usage) : null,
      updated.result ? JSON.stringify(updated.result) : null,
      updated.error ?? null,
      id,
    );
  return updated;
}

export async function recoverInterruptedRuns(database: AppDatabase): Promise<number> {
  const interrupted = database
    .prepare("SELECT * FROM agent_runs WHERE status IN ('queued', 'running', 'waiting') ORDER BY created_at")
    .all()
    .map((row) => runFrom(row as Row));
  if (interrupted.length === 0) return 0;

  withTransaction(database, () => {
    for (const run of interrupted) {
      const error = "Server restarted while the AgentRun was active. Retry the task to continue.";
      updateRunSync(database, run.id, { status: "failed", finishedAt: now(), error });
      const workflowRow = database
        .prepare("SELECT * FROM task_workflow_steps WHERE run_id = ?")
        .get(run.id);
      const workflowStep = workflowRow ? workflowStepFrom(workflowRow as Row) : undefined;
      if (workflowStep) updateWorkflowStepSync(database, workflowStep.id, { status: "failed" });
      const task = getTaskSync(database, run.taskId);
      if (task && ["working", "needs_input", "blocked"].includes(task.status)) {
        const failedTask = transitionTaskSync(database, task.id, "failed");
        createActivitySync(database, {
          workspaceId: failedTask.workspaceId,
          type: "task_failed",
          taskId: failedTask.id,
          agentId: run.agentId,
          runId: run.id,
          message: error,
        });
      }
    }
  });
  return interrupted.length;
}

export async function latestRun(database: AppDatabase, taskId: string): Promise<AgentRun | undefined> {
  const row = database
    .prepare("SELECT * FROM agent_runs WHERE task_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(taskId);
  return row ? runFrom(row as Row) : undefined;
}

export async function updateRun(
  database: AppDatabase,
  id: string,
  patch: Partial<
    Pick<
      AgentRun,
      | "status"
      | "runtimeThreadId"
      | "startedAt"
      | "finishedAt"
      | "eventLogRef"
      | "usage"
      | "result"
      | "error"
    >
  >,
): Promise<AgentRun> {
  return updateRunSync(database, id, patch);
}
