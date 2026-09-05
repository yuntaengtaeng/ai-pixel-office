import { randomUUID } from "node:crypto";
import type { ActivityLog, ActivityType } from "@ai-pixel-office/domain";
import type { AppDatabase } from "../database.ts";
import { json, now, optional, type Row } from "./rows.ts";

export type CreateActivityInput = {
  workspaceId: string;
  type: ActivityType;
  message: string;
  agentId?: string;
  taskId?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
};

export function createActivitySync(
  database: AppDatabase,
  input: CreateActivityInput,
): ActivityLog {
  const activity: ActivityLog = { id: randomUUID(), ...input, createdAt: now() };
  database
    .prepare(
      `INSERT INTO activity_logs
      (id, workspace_id, type, agent_id, task_id, run_id, message, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      activity.id,
      activity.workspaceId,
      activity.type,
      activity.agentId ?? null,
      activity.taskId ?? null,
      activity.runId ?? null,
      activity.message,
      activity.metadata ? JSON.stringify(activity.metadata) : null,
      activity.createdAt,
    );
  return activity;
}

export async function createActivity(
  database: AppDatabase,
  input: CreateActivityInput,
): Promise<ActivityLog> {
  return createActivitySync(database, input);
}

export async function listActivities(
  database: AppDatabase,
  workspaceId: string,
  limit = 100,
): Promise<ActivityLog[]> {
  return database
    .prepare(
      "SELECT * FROM activity_logs WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
    )
    .all(workspaceId, Math.min(Math.max(limit, 1), 500))
    .map((raw) => {
      const row = raw as Row;
      return {
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        type: row.type as ActivityType,
        agentId: optional(row.agent_id),
        taskId: optional(row.task_id),
        runId: optional(row.run_id),
        message: String(row.message),
        metadata: json<Record<string, unknown> | undefined>(row.metadata_json, undefined),
        createdAt: String(row.created_at),
      };
    });
}
