import { randomUUID } from "node:crypto";
import { DomainError, type Project } from "@ai-pixel-office/domain";
import { requireEntity } from "../database.ts";
import type { AppDatabase } from "../database.ts";
import { now, projectFrom, type Row } from "./rows.ts";
import { requireChanged, withTransaction } from "./shared.ts";
import { getWorkspace } from "./workspaces.ts";

export async function listProjectDirectories(
  database: AppDatabase,
  workspaceId: string,
): Promise<Project[]> {
  return database
    .prepare("SELECT * FROM projects WHERE workspace_id = ? ORDER BY status, updated_at DESC")
    .all(workspaceId)
    .map((row) => projectFrom(row as Row));
}

export async function getProject(
  database: AppDatabase,
  id: string,
): Promise<Project | undefined> {
  const row = database.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return row ? projectFrom(row as Row) : undefined;
}

export function getProjectSync(database: AppDatabase, id: string): Project | undefined {
  const row = database.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return row ? projectFrom(row as Row) : undefined;
}

export async function createProjectDirectory(
  database: AppDatabase,
  input: Pick<Project, "workspaceId" | "name"> &
    Partial<Pick<Project, "description" | "status" | "figmaUrl" | "path">>,
): Promise<Project> {
  requireEntity(await getWorkspace(database, input.workspaceId), "Workspace", input.workspaceId);
  const createdAt = now();
  const project: Project = {
    id: randomUUID(),
    ...input,
    status: input.status ?? "active",
    createdAt,
    updatedAt: createdAt,
  };
  database
    .prepare(
      `INSERT INTO projects
    (id, workspace_id, name, description, status, figma_url, working_directory, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      project.id,
      project.workspaceId,
      project.name,
      project.description ?? null,
      project.status,
      project.figmaUrl ?? null,
      project.path ?? null,
      project.createdAt,
      project.updatedAt,
    );
  return project;
}

function writeProject(database: AppDatabase, project: Project): void {
  database
    .prepare(
      "UPDATE projects SET name = ?, description = ?, status = ?, figma_url = ?, working_directory = ?, updated_at = ? WHERE id = ?",
    )
    .run(
      project.name,
      project.description ?? null,
      project.status,
      project.figmaUrl ?? null,
      project.path ?? null,
      project.updatedAt,
      project.id,
    );
}

export async function updateProject(
  database: AppDatabase,
  id: string,
  input: Partial<Pick<Project, "name" | "description" | "status" | "figmaUrl" | "path">>,
): Promise<Project> {
  return withTransaction(database, () => {
    const current = requireEntity(getProjectSync(database, id), "Project", id);
    if ("path" in input && input.path !== current.path) {
      const runs = database
        .prepare(
          `SELECT COUNT(*) AS count FROM agent_runs
           JOIN tasks ON tasks.id = agent_runs.task_id
           WHERE tasks.project_id = ?`,
        )
        .get(id) as { count: number };
      if (runs.count > 0) {
        throw new DomainError(
          "PROJECT_SCOPE_LOCKED",
          "실행 이력이 있는 프로젝트의 폴더는 변경할 수 없습니다",
          409,
        );
      }
    }
    const updated: Project = { ...current, ...input, updatedAt: now() };
    writeProject(database, updated);
    return updated;
  });
}

export async function deleteProjectDirectory(database: AppDatabase, id: string): Promise<void> {
  requireEntity(await getProject(database, id), "Project", id);
  const referenced = database
    .prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?")
    .get(id) as { count: number };
  if (referenced.count > 0) {
    throw new DomainError(
      "PROJECT_IN_USE",
      "연결된 작업이 있는 프로젝트는 삭제할 수 없습니다",
      409,
    );
  }
  requireChanged(database.prepare("DELETE FROM projects WHERE id = ?").run(id), "Project", id);
}

export type ProjectLookup = (id: string) => Promise<Project | undefined>;

export async function assertProjectWorkspace(
  database: AppDatabase,
  projectId: string,
  workspaceId: string,
  lookupProject: ProjectLookup = (id) => getProject(database, id),
): Promise<void> {
  const project = requireEntity(await lookupProject(projectId), "Project", projectId);
  if (project.workspaceId !== workspaceId) {
    throw new DomainError("PROJECT_SCOPE_MISMATCH", "Project belongs to another workspace", 422);
  }
}
