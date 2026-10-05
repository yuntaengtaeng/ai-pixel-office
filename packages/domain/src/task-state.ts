import { DomainError } from "./errors.ts";
import type { TaskStatus } from "./entities.ts";

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["working"],
  working: ["needs_review", "needs_input", "blocked", "todo", "failed", "done"],
  needs_review: ["done", "working"],
  needs_input: ["working", "todo", "blocked", "failed"],
  blocked: ["todo", "working", "failed"],
  done: ["working"],
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

/** 사용자의 판단을 기다리는 상태 (결재, 질문·권한, 막힘, 실패) */
export const AWAITING_USER_STATUSES = [
  "needs_review",
  "needs_input",
  "blocked",
  "failed",
] as const satisfies readonly TaskStatus[];

export function isAwaitingUser(status: TaskStatus | "idle"): boolean {
  return (AWAITING_USER_STATUSES as readonly string[]).includes(status);
}
