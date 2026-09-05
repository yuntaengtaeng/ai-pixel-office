import { randomUUID } from "node:crypto";
import type { TaskReview } from "@ai-pixel-office/domain";
import type { AppDatabase } from "../database.ts";
import { now, optional, type Row } from "./rows.ts";

export function createReviewSync(
  database: AppDatabase,
  input: Omit<TaskReview, "id" | "createdAt">,
): TaskReview {
  const review: TaskReview = { id: randomUUID(), ...input, createdAt: now() };
  database
    .prepare(
      "INSERT INTO task_reviews (id, task_id, run_id, action, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      review.id,
      review.taskId,
      review.runId ?? null,
      review.action,
      review.feedback ?? null,
      review.createdAt,
    );
  return review;
}

export async function createReview(
  database: AppDatabase,
  input: Omit<TaskReview, "id" | "createdAt">,
): Promise<TaskReview> {
  return createReviewSync(database, input);
}

export async function listReviews(database: AppDatabase, taskId: string): Promise<TaskReview[]> {
  return database
    .prepare("SELECT * FROM task_reviews WHERE task_id = ? ORDER BY created_at DESC")
    .all(taskId)
    .map((raw) => {
      const row = raw as Row;
      return {
        id: String(row.id),
        taskId: String(row.task_id),
        runId: optional(row.run_id),
        action: row.action as TaskReview["action"],
        feedback: optional(row.feedback),
        createdAt: String(row.created_at),
      };
    });
}
