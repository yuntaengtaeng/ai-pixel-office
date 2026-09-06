import type { Task } from "@ai-pixel-office/domain/entities";

/** 대화 스레드가 주 무대인 chat 기원 작업은 /chat, 나머지는 /tasks로 안내 */
export function resolveTaskHref(task: Pick<Task, "id" | "origin">): string {
  return task.origin === "chat" ? `/chat/${task.id}` : `/tasks/${task.id}`;
}
