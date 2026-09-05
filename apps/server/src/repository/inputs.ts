import { randomUUID } from "node:crypto";
import {
  DomainError,
  type CreateInputInput,
  type CreateTaskInput,
  type Input,
  type InputStatus,
  type Task,
  type UpdateInputInput,
} from "@ai-pixel-office/domain";
import { requireEntity } from "../database.ts";
import type { AppDatabase } from "../database.ts";
import { inputFrom, now, type Row } from "./rows.ts";
import { requireChanged, withTransaction } from "./shared.ts";
import { createActivity, createActivitySync } from "./activities.ts";
import { assertAgentWorkspace, type AgentLookup } from "./agents.ts";
import { assertProjectWorkspace, type ProjectLookup } from "./projects.ts";
import { insertTask } from "./tasks.ts";
import { getWorkspace } from "./workspaces.ts";

export async function listInputs(
  database: AppDatabase,
  workspaceId: string,
  status?: InputStatus,
): Promise<Input[]> {
  requireEntity(await getWorkspace(database, workspaceId), "Workspace", workspaceId);
  const rows = status
    ? database
        .prepare(
          "SELECT * FROM inputs WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC, rowid DESC",
        )
        .all(workspaceId, status)
    : database
        .prepare("SELECT * FROM inputs WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC")
        .all(workspaceId);
  return rows.map((row) => inputFrom(row as Row));
}

export async function getInput(database: AppDatabase, id: string): Promise<Input | undefined> {
  const row = database.prepare("SELECT * FROM inputs WHERE id = ?").get(id);
  return row ? inputFrom(row as Row) : undefined;
}

function getInputSync(database: AppDatabase, id: string): Input | undefined {
  const row = database.prepare("SELECT * FROM inputs WHERE id = ?").get(id);
  return row ? inputFrom(row as Row) : undefined;
}

function writeInput(database: AppDatabase, input: Input): void {
  database
    .prepare(`UPDATE inputs SET type = ?, title = ?, content = ?, status = ?, updated_at = ? WHERE id = ?`)
    .run(input.type, input.title ?? null, input.content, input.status, input.updatedAt, input.id);
}

export async function createInput(
  database: AppDatabase,
  input: CreateInputInput,
): Promise<Input> {
  requireEntity(await getWorkspace(database, input.workspaceId), "Workspace", input.workspaceId);
  const createdAt = now();
  const captured: Input = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    type: input.type ?? "request",
    title: input.title,
    content: input.content,
    status: "inbox",
    createdAt,
    updatedAt: createdAt,
  };
  database
    .prepare(
      `INSERT INTO inputs (id, workspace_id, type, title, content, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      captured.id,
      captured.workspaceId,
      captured.type,
      captured.title ?? null,
      captured.content,
      captured.status,
      captured.createdAt,
      captured.updatedAt,
    );
  await createActivity(database, {
    workspaceId: captured.workspaceId,
    type: "input_created",
    message: `Inbox에 담음: ${captured.title ?? captured.content.slice(0, 60)}`,
    metadata: { inputId: captured.id },
  });
  return captured;
}

export async function updateInput(
  database: AppDatabase,
  id: string,
  input: UpdateInputInput,
): Promise<Input> {
  const current = requireEntity(await getInput(database, id), "Input", id);
  if (current.status === "converted") {
    throw new DomainError("INPUT_ALREADY_CONVERTED", "이미 작업으로 전환된 Inbox 항목입니다.", 409);
  }
  const updated: Input = { ...current, ...input, updatedAt: now() };
  writeInput(database, updated);
  if (updated.status === "archived" && current.status !== "archived") {
    await createActivity(database, {
      workspaceId: updated.workspaceId,
      type: "input_archived",
      message: `Inbox 보관: ${updated.title ?? updated.content.slice(0, 60)}`,
      metadata: { inputId: updated.id },
    });
  }
  return updated;
}

export async function deleteInput(database: AppDatabase, id: string): Promise<void> {
  requireChanged(database.prepare("DELETE FROM inputs WHERE id = ?").run(id), "Input", id);
}

export async function convertInput(
  database: AppDatabase,
  id: string,
  taskInput: Partial<
    Pick<CreateTaskInput, "title" | "description" | "assigneeAgentId" | "priority" | "projectId">
  >,
  lookups?: { lookupAgent?: AgentLookup; lookupProject?: ProjectLookup },
): Promise<{ input: Input; task: Task }> {
  const captured = requireEntity(await getInput(database, id), "Input", id);
  if (captured.status === "converted") {
    throw new DomainError("INPUT_ALREADY_CONVERTED", "이미 작업으로 전환된 Inbox 항목입니다.", 409);
  }
  if (taskInput.assigneeAgentId)
    await assertAgentWorkspace(
      database,
      taskInput.assigneeAgentId,
      captured.workspaceId,
      lookups?.lookupAgent,
    );
  if (taskInput.projectId)
    await assertProjectWorkspace(
      database,
      taskInput.projectId,
      captured.workspaceId,
      lookups?.lookupProject,
    );

  return withTransaction(database, () => {
    const current = requireEntity(getInputSync(database, id), "Input", id);
    if (current.status === "converted") {
      throw new DomainError("INPUT_ALREADY_CONVERTED", "이미 작업으로 전환된 Inbox 항목입니다.", 409);
    }
    const task = insertTask(database, {
      workspaceId: current.workspaceId,
      title: taskInput.title ?? current.title ?? current.content.slice(0, 80),
      description: taskInput.description ?? current.content,
      assigneeAgentId: taskInput.assigneeAgentId,
      priority: taskInput.priority ?? "medium",
      projectId: taskInput.projectId,
      sourceInputId: current.id,
    });
    createActivitySync(database, {
      workspaceId: task.workspaceId,
      type: "task_created",
      taskId: task.id,
      message: `Task created: ${task.title}`,
    });
    const converted: Input = { ...current, status: "converted", updatedAt: now() };
    writeInput(database, converted);
    createActivitySync(database, {
      workspaceId: converted.workspaceId,
      type: "input_converted",
      taskId: task.id,
      message: `Inbox에서 작업 생성: ${task.title}`,
      metadata: { inputId: converted.id },
    });
    return { input: converted, task };
  });
}
