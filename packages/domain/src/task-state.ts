import { DomainError } from "./errors.ts";
import type { TaskStatus } from "./entities.ts";

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["working"],
  working: ["needs_review", "needs_input", "blocked", "todo", "failed"],
  needs_review: ["done", "working"],
  needs_input: ["working", "todo", "blocked", "failed"],
  blocked: ["todo", "working", "failed"],
  done: [],
  failed: ["todo"],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || transitions[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) {
    throw new DomainError(
      "INVALID_TASK_TRANSITION",
      `Task cannot transition from ${from} to ${to}`,
      409,
    );
  }
}
