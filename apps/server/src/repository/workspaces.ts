import { randomUUID } from "node:crypto";
import type { CreateWorkspaceInput, UpdateWorkspaceInput, Workspace } from "@ai-pixel-office/domain";
import { requireEntity } from "../database.ts";
import type { AppDatabase } from "../database.ts";
import { assertAgentWorkspace } from "./agents.ts";
import { now, type Row, workspaceFrom } from "./rows.ts";
import { requireChanged } from "./shared.ts";

export async function listWorkspaces(database: AppDatabase): Promise<Workspace[]> {
  return database
    .prepare("SELECT * FROM workspaces ORDER BY created_at")
    .all()
    .map((row) => workspaceFrom(row as Row));
}

export async function getWorkspace(
  database: AppDatabase,
  id: string,
): Promise<Workspace | undefined> {
  const row = database.prepare("SELECT * FROM workspaces WHERE id = ?").get(id);
  return row ? workspaceFrom(row as Row) : undefined;
}

export async function createWorkspace(
  database: AppDatabase,
  input: CreateWorkspaceInput,
): Promise<Workspace> {
  const createdAt = now();
  const workspace: Workspace = { id: randomUUID(), ...input, createdAt, updatedAt: createdAt };
  database
    .prepare(
      "INSERT INTO workspaces (id, name, working_directory, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      workspace.id,
      workspace.name,
      workspace.workingDirectory ?? null,
      workspace.createdAt,
      workspace.updatedAt,
    );
  return workspace;
}

export async function updateWorkspace(
  database: AppDatabase,
  id: string,
  input: UpdateWorkspaceInput,
): Promise<Workspace> {
  const current = requireEntity(await getWorkspace(database, id), "Workspace", id);
  if (input.defaultAgentId) await assertAgentWorkspace(database, input.defaultAgentId, id);
  const updated = { ...current, ...input, updatedAt: now() };
  database
    .prepare(
      "UPDATE workspaces SET name = ?, working_directory = ?, default_agent_id = ?, updated_at = ? WHERE id = ?",
    )
    .run(updated.name, updated.workingDirectory ?? null, updated.defaultAgentId ?? null, updated.updatedAt, id);
  return updated;
}

export async function deleteWorkspace(database: AppDatabase, id: string): Promise<void> {
  requireChanged(
    database.prepare("DELETE FROM workspaces WHERE id = ?").run(id),
    "Workspace",
    id,
  );
}
