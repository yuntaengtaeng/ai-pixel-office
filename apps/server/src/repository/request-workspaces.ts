import type { AppDatabase } from "../database.ts";
import { now, type Row } from "./rows.ts";

/** 기안서가 작업 공간에서 실행하기로 정해진 사실 (작업 공간을 처음 만들 때 기록) */
export type RequestWorkspaceBinding = {
  taskId: string;
  projectId: string;
  /** 사용자 프로젝트 폴더가 속한 저장소 루트 */
  repositoryRoot: string;
  /** 저장소 루트 기준 프로젝트 경로 (POSIX 구분자) */
  scope: string;
};

export function getRequestWorkspaceBinding(
  database: AppDatabase,
  taskId: string,
): RequestWorkspaceBinding | undefined {
  const row = database.prepare("SELECT * FROM request_workspaces WHERE task_id = ?").get(taskId) as
    Row | undefined;
  if (!row) return undefined;
  return {
    taskId: String(row.task_id),
    projectId: String(row.project_id),
    repositoryRoot: String(row.repository_root),
    scope: String(row.scope),
  };
}

export function saveRequestWorkspaceBinding(
  database: AppDatabase,
  binding: RequestWorkspaceBinding,
): void {
  database
    .prepare(
      `INSERT OR IGNORE INTO request_workspaces
       (task_id, project_id, repository_root, scope, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(binding.taskId, binding.projectId, binding.repositoryRoot, binding.scope, now());
}
