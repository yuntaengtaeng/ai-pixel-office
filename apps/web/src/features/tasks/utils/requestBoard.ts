import type { Task } from "@ai-pixel-office/domain/entities";
import { requestStateOf, type RequestState } from "./requestState.ts";

export type RequestColumnId = "queued" | "working" | "needs_me" | "review" | "done";

export const REQUEST_COLUMNS: Array<{ id: RequestColumnId; label: string }> = [
  { id: "queued", label: "순서 대기" },
  { id: "working", label: "진행 중" },
  { id: "needs_me", label: "내 답변 필요" },
  { id: "review", label: "결재 대기" },
  { id: "done", label: "완료" },
];

const COLUMN_OF_STATE: Record<RequestState, RequestColumnId> = {
  queued: "queued",
  todo: "working",
  working: "working",
  needs_input: "needs_me",
  blocked: "needs_me",
  failed: "needs_me",
  needs_review: "review",
  done: "done",
};

export function requestColumnOf(task: Pick<Task, "status" | "queuedBehind">): RequestColumnId {
  return COLUMN_OF_STATE[requestStateOf(task)];
}

/** 보드 칸별 기안서 (칸 안에서는 최근에 바뀐 순) */
export function groupRequestsByColumn(tasks: Task[]): Record<RequestColumnId, Task[]> {
  const columns: Record<RequestColumnId, Task[]> = {
    queued: [],
    working: [],
    needs_me: [],
    review: [],
    done: [],
  };
  const recentFirst = [...tasks].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  for (const task of recentFirst) columns[requestColumnOf(task)].push(task);
  return columns;
}

/** 사이드바에 펼칠 기안서 (끝나지 않은 것만, 판단이 필요한 것부터) */
export function activeRequestsForSidebar(tasks: Task[], limit: number): Task[] {
  const priority: Record<RequestColumnId, number> = {
    needs_me: 0,
    review: 1,
    working: 2,
    queued: 3,
    done: 4,
  };
  return tasks
    .filter((task) => task.status !== "done")
    .sort(
      (left, right) =>
        priority[requestColumnOf(left)] - priority[requestColumnOf(right)] ||
        right.updatedAt.localeCompare(left.updatedAt),
    )
    .slice(0, limit);
}
