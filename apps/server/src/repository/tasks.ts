import { randomUUID } from "node:crypto";
import {
  assertTaskTransition,
  type CreateTaskInput,
  type Task,
  type TaskOrigin,
  type TaskResult,
  type TaskStatus,
  type UpdateTaskInput,
} from "@ai-pixel-office/domain";
import { DomainError } from "@ai-pixel-office/domain";
import { requireEntity } from "../database.ts";
import type { AppDatabase } from "../database.ts";
import { now, type Row, taskFrom } from "./rows.ts";
import { requireChanged, withTransaction } from "./shared.ts";
import { createActivity } from "./activities.ts";
import { assertAgentWorkspace, type AgentLookup } from "./agents.ts";
import { assertProjectWorkspace, type ProjectLookup } from "./projects.ts";
import { getWorkspace } from "./workspaces.ts";
import { evaluatePetUnlocks } from "./pet-unlocks.ts";

export type TaskScopeLookups = { lookupAgent?: AgentLookup; lookupProject?: ProjectLookup };

export async function listTasks(
  database: AppDatabase,
  workspaceId?: string,
  status?: TaskStatus,
  origin?: TaskOrigin,
): Promise<Task[]> {
  const clauses: string[] = [];
  const params: string[] = [];
  if (workspaceId) {
    clauses.push("workspace_id = ?");
    params.push(workspaceId);
  }
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  if (origin) {
    clauses.push("origin = ?");
    params.push(origin);
  }
  const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  const rows = database
    .prepare(`SELECT * FROM tasks${where} ORDER BY created_at DESC`)
    .all(...params) as Row[];
  return rows.map(taskFrom);
}

export async function getTask(database: AppDatabase, id: string): Promise<Task | undefined> {
  const row = database.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return row ? taskFrom(row as Row) : undefined;
}

export function getTaskSync(database: AppDatabase, id: string): Task | undefined {
  const row = database.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return row ? taskFrom(row as Row) : undefined;
}

export function insertTask(database: AppDatabase, input: CreateTaskInput): Task {
  const createdAt = now();
  const task: Task = {
    id: randomUUID(),
    ...input,
    status: "todo",
    origin: input.origin ?? "office",
    createdAt,
    updatedAt: createdAt,
  };
  database
    .prepare(
      `INSERT INTO tasks
      (id, workspace_id, title, description, status, assignee_agent_id,
       due_date, priority, project_id, working_directory, origin, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      task.id,
      task.workspaceId,
      task.title,
      task.description ?? null,
      task.status,
      task.assigneeAgentId ?? null,
      task.dueDate ?? null,
      task.priority ?? null,
      task.projectId ?? null,
      task.workingDirectory ?? null,
      task.origin,
      task.createdAt,
      task.updatedAt,
    );
  return task;
}

export function writeTask(database: AppDatabase, task: Task): void {
  database
    .prepare(
      `UPDATE tasks SET title = ?, description = ?, status = ?, assignee_agent_id = ?,
      due_date = ?, priority = ?, project_id = ?, working_directory = ?, result_json = ?, updated_at = ?, completed_at = ?
      WHERE id = ?`,
    )
    .run(
      task.title,
      task.description ?? null,
      task.status,
      task.assigneeAgentId ?? null,
      task.dueDate ?? null,
      task.priority ?? null,
      task.projectId ?? null,
      task.workingDirectory ?? null,
      task.result ? JSON.stringify(task.result) : null,
      task.updatedAt,
      task.completedAt ?? null,
      task.id,
    );
}

export async function createTask(
  database: AppDatabase,
  input: CreateTaskInput,
  lookups?: TaskScopeLookups,
): Promise<Task> {
  requireEntity(await getWorkspace(database, input.workspaceId), "Workspace", input.workspaceId);
  if (input.assigneeAgentId)
    await assertAgentWorkspace(
      database,
      input.assigneeAgentId,
      input.workspaceId,
      lookups?.lookupAgent,
    );
  if (input.projectId)
    await assertProjectWorkspace(
      database,
      input.projectId,
      input.workspaceId,
      lookups?.lookupProject,
    );
  const task = insertTask(database, input);
  await createActivity(database, {
    workspaceId: task.workspaceId,
    type: "task_created",
    taskId: task.id,
    message: `Task created: ${task.title}`,
  });
  return task;
}

export async function updateTask(
  database: AppDatabase,
  id: string,
  input: UpdateTaskInput,
  lookups?: TaskScopeLookups,
): Promise<Task> {
  const captured = requireEntity(await getTask(database, id), "Task", id);
  const assigneeAgentId = input.assigneeAgentId ?? captured.assigneeAgentId;
  const projectId = "projectId" in input ? input.projectId : captured.projectId;
  if (assigneeAgentId)
    await assertAgentWorkspace(
      database,
      assigneeAgentId,
      captured.workspaceId,
      lookups?.lookupAgent,
    );
  if (projectId)
    await assertProjectWorkspace(database, projectId, captured.workspaceId, lookups?.lookupProject);

  return withTransaction(database, () => {
    const current = requireEntity(getTaskSync(database, id), "Task", id);
    if ("assigneeAgentId" in input && input.assigneeAgentId !== current.assigneeAgentId) {
      const activeRun = database
        .prepare(
          "SELECT id FROM agent_runs WHERE task_id = ? AND status IN ('queued', 'running', 'waiting') LIMIT 1",
        )
        .get(id);
      if (activeRun) {
        throw new DomainError(
          "TASK_ASSIGNMENT_LOCKED",
          "실행 중인 작업의 담당 Agent는 변경할 수 없습니다",
          409,
        );
      }
    }
    if ("projectId" in input && input.projectId !== current.projectId) {
      const runs = database
        .prepare("SELECT COUNT(*) AS count FROM agent_runs WHERE task_id = ?")
        .get(id) as { count: number };
      if (runs.count > 0) {
        throw new DomainError(
          "TASK_SCOPE_LOCKED",
          "실행 이력이 있는 작업의 프로젝트는 변경할 수 없습니다",
          409,
        );
      }
    }
    const updated: Task = { ...current, ...input, updatedAt: now() };
    writeTask(database, updated);
    return updated;
  });
}

export function transitionTaskSync(
  database: AppDatabase,
  id: string,
  status: TaskStatus,
  result?: TaskResult,
): Task {
  const current = requireEntity(getTaskSync(database, id), "Task", id);
  assertTaskTransition(current.status, status);
  const updated: Task = {
    ...current,
    status,
    ...(result !== undefined ? { result } : {}),
    updatedAt: now(),
    completedAt: status === "done" ? now() : undefined,
  };
  writeTask(database, updated);
  return updated;
}

export async function transitionTask(
  database: AppDatabase,
  id: string,
  status: TaskStatus,
  result?: TaskResult,
): Promise<Task> {
  return withTransaction(database, () => {
    const task = transitionTaskSync(database, id, status, result);
    if (status === "done") evaluatePetUnlocks(database, task.workspaceId);
    return task;
  });
}

export async function deleteTask(database: AppDatabase, id: string): Promise<void> {
  requireChanged(database.prepare("DELETE FROM tasks WHERE id = ?").run(id), "Task", id);
}
