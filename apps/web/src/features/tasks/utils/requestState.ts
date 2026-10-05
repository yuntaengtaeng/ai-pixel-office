import type { Task, TaskStatus } from "@ai-pixel-office/domain/entities";

export type RequestState = TaskStatus | "queued";

/** 기안서가 지금 어떤 상태로 보여야 하는지 (같은 프로젝트 폴더를 기다리면 순서 대기) */
export function requestStateOf(task: Pick<Task, "status" | "queuedBehind">): RequestState {
  return task.status === "todo" && task.queuedBehind ? "queued" : task.status;
}
