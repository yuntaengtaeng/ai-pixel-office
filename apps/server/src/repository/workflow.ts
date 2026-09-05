import { randomUUID } from "node:crypto";
import { DomainError, type TaskWorkflowStep, type WorkflowPreset } from "@ai-pixel-office/domain";
import { requireEntity } from "../database.ts";
import type { AppDatabase } from "../database.ts";
import { now, type Row, workflowPresetFrom, workflowStepFrom } from "./rows.ts";
import { withTransaction, requireChanged } from "./shared.ts";
import { createActivity } from "./activities.ts";
import { assertAgentWorkspace, type AgentLookup } from "./agents.ts";
import { getTask, getTaskSync, writeTask } from "./tasks.ts";
import { getWorkspace } from "./workspaces.ts";
import { listRuns } from "./runs.ts";

export async function listWorkflowSteps(
  database: AppDatabase,
  taskId: string,
): Promise<TaskWorkflowStep[]> {
  return database
    .prepare("SELECT * FROM task_workflow_steps WHERE task_id = ? ORDER BY position")
    .all(taskId)
    .map((row) => workflowStepFrom(row as Row));
}

export async function listWorkflowPresets(
  database: AppDatabase,
  workspaceId: string,
): Promise<WorkflowPreset[]> {
  requireEntity(await getWorkspace(database, workspaceId), "Workspace", workspaceId);
  return database
    .prepare("SELECT * FROM workflow_presets WHERE workspace_id = ? ORDER BY updated_at DESC")
    .all(workspaceId)
    .map((row) => workflowPresetFrom(row as Row));
}

export async function createWorkflowPreset(
  database: AppDatabase,
  input: { workspaceId: string; name: string; agentIds: string[] },
  lookupAgent?: AgentLookup,
): Promise<WorkflowPreset> {
  requireEntity(await getWorkspace(database, input.workspaceId), "Workspace", input.workspaceId);
  const name = input.name.trim();
  if (!name) throw new DomainError("INVALID_WORKFLOW_PRESET", "협업 그룹 이름을 입력해 주세요.");
  if (input.agentIds.length < 2 || input.agentIds.length > 8) {
    throw new DomainError(
      "INVALID_WORKFLOW_PRESET",
      "협업 그룹은 2명 이상 8명 이하의 에이전트로 구성해 주세요.",
    );
  }
  if (new Set(input.agentIds).size !== input.agentIds.length) {
    throw new DomainError(
      "INVALID_WORKFLOW_PRESET",
      "같은 에이전트를 협업 그룹에 중복 배치할 수 없습니다.",
    );
  }
  for (const agentId of input.agentIds)
    await assertAgentWorkspace(database, agentId, input.workspaceId, lookupAgent);
  const createdAt = now();
  const preset: WorkflowPreset = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    name,
    agentIds: [...input.agentIds],
    createdAt,
    updatedAt: createdAt,
  };
  try {
    database
      .prepare(
        `INSERT INTO workflow_presets
        (id, workspace_id, name, agent_ids_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        preset.id,
        preset.workspaceId,
        preset.name,
        JSON.stringify(preset.agentIds),
        preset.createdAt,
        preset.updatedAt,
      );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new DomainError("WORKFLOW_PRESET_EXISTS", "같은 이름의 협업 그룹이 이미 있습니다.", 409);
    }
    throw error;
  }
  return preset;
}

export async function deleteWorkflowPreset(database: AppDatabase, id: string): Promise<void> {
  requireChanged(
    database.prepare("DELETE FROM workflow_presets WHERE id = ?").run(id),
    "WorkflowPreset",
    id,
  );
}

export async function getWorkflowStepByRun(
  database: AppDatabase,
  runId: string,
): Promise<TaskWorkflowStep | undefined> {
  const row = database.prepare("SELECT * FROM task_workflow_steps WHERE run_id = ?").get(runId);
  return row ? workflowStepFrom(row as Row) : undefined;
}

export function getWorkflowStepSync(
  database: AppDatabase,
  id: string,
): TaskWorkflowStep | undefined {
  const row = database.prepare("SELECT * FROM task_workflow_steps WHERE id = ?").get(id);
  return row ? workflowStepFrom(row as Row) : undefined;
}

export function updateWorkflowStepSync(
  database: AppDatabase,
  id: string,
  input: Partial<Pick<TaskWorkflowStep, "status" | "runId" | "result">>,
): TaskWorkflowStep {
  const current = requireEntity(getWorkflowStepSync(database, id), "WorkflowStep", id);
  const updated = { ...current, ...input, updatedAt: now() };
  database
    .prepare(
      `UPDATE task_workflow_steps SET status = ?, run_id = ?, result_json = ?, updated_at = ?
      WHERE id = ?`,
    )
    .run(
      updated.status,
      updated.runId ?? null,
      updated.result ? JSON.stringify(updated.result) : null,
      updated.updatedAt,
      id,
    );
  return updated;
}

export async function setTaskWorkflow(
  database: AppDatabase,
  taskId: string,
  agentIds: string[],
  lookupAgent?: AgentLookup,
): Promise<TaskWorkflowStep[]> {
  const task = requireEntity(await getTask(database, taskId), "Task", taskId);
  if (task.status !== "todo" || (await listRuns(database, taskId)).length > 0) {
    throw new DomainError(
      "WORKFLOW_ALREADY_STARTED",
      "실행 기록이 없는 Todo 작업에서만 Workflow를 변경할 수 있습니다.",
      409,
    );
  }
  if (agentIds.length === 1 || agentIds.length > 8) {
    throw new DomainError(
      "INVALID_WORKFLOW",
      "Workflow는 2명 이상 8명 이하의 에이전트로 구성해 주세요.",
    );
  }
  if (new Set(agentIds).size !== agentIds.length) {
    throw new DomainError("INVALID_WORKFLOW", "같은 에이전트를 중복 배치할 수 없습니다.");
  }
  for (const agentId of agentIds)
    await assertAgentWorkspace(database, agentId, task.workspaceId, lookupAgent);

  const steps = withTransaction(database, () => {
    const currentTask = requireEntity(getTaskSync(database, taskId), "Task", taskId);
    const run = database.prepare("SELECT id FROM agent_runs WHERE task_id = ? LIMIT 1").get(taskId);
    if (currentTask.status !== "todo" || run) {
      throw new DomainError(
        "WORKFLOW_ALREADY_STARTED",
        "실행 기록이 없는 Todo 작업에서만 Workflow를 변경할 수 있습니다.",
        409,
      );
    }
    database.prepare("DELETE FROM task_workflow_steps WHERE task_id = ?").run(taskId);
    const insert = database.prepare(
      `INSERT INTO task_workflow_steps
      (id, task_id, agent_id, position, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    );
    const createdAt = now();
    const created = agentIds.map((agentId, position) => {
      const step: TaskWorkflowStep = {
        id: randomUUID(),
        taskId,
        agentId,
        position,
        status: "pending",
        createdAt,
        updatedAt: createdAt,
      };
      insert.run(step.id, taskId, agentId, position, createdAt, createdAt);
      return step;
    });
    if (agentIds[0])
      writeTask(database, { ...currentTask, assigneeAgentId: agentIds[0], updatedAt: now() });
    return created;
  });
  await createActivity(database, {
    workspaceId: task.workspaceId,
    type: "workflow_configured",
    taskId,
    message:
      steps.length > 0 ? `${steps.length}단계 순차 Workflow 구성` : "순차 Workflow 사용 안 함",
  });
  return steps;
}

export async function updateWorkflowStep(
  database: AppDatabase,
  id: string,
  input: Partial<Pick<TaskWorkflowStep, "status" | "runId" | "result">>,
): Promise<TaskWorkflowStep> {
  return updateWorkflowStepSync(database, id, input);
}

export async function resetFailedWorkflowStep(
  database: AppDatabase,
  taskId: string,
): Promise<TaskWorkflowStep | undefined> {
  const steps = await listWorkflowSteps(database, taskId);
  const failed = steps.find((step) => step.status === "failed");
  return failed
    ? await updateWorkflowStep(database, failed.id, { status: "pending", runId: undefined })
    : undefined;
}
