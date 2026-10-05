import type { ActivityLog, Task } from "@ai-pixel-office/domain/entities";

/** 결재함에 올라오는 서류 종류 */
export type DeskDocumentKind = "permission" | "question" | "failure" | "supplement" | "draft";

export type DeskItem = {
  kind: DeskDocumentKind;
  task: Task;
  /** 사람의 판단을 기다리기 시작한 시각 */
  waitingSince: string;
};

export const DESK_DOCUMENT_LABEL: Record<DeskDocumentKind, string> = {
  permission: "권한 요청서",
  question: "질의서",
  failure: "실패 보고서",
  supplement: "보완 요청",
  draft: "기안서",
};

export const DESK_ACTION_LABEL: Record<DeskDocumentKind, string> = {
  permission: "검토하기",
  question: "답변 쓰기",
  failure: "살펴보기",
  supplement: "살펴보기",
  draft: "결재하기",
};

/** 작업을 막고 있는 서류가 먼저 오는 순서 */
const DESK_PRIORITY: DeskDocumentKind[] = [
  "permission",
  "question",
  "failure",
  "supplement",
  "draft",
];

/** 아직 응답하지 않은 권한 요청이 있는 Task id 목록 */
export function tasksWithPendingApproval(activities: ActivityLog[]): Set<string> {
  const pending = new Set<string>();
  const oldestFirst = [...activities].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const activity of oldestFirst) {
    if (!activity.taskId) continue;
    if (activity.type === "approval_requested") pending.add(activity.taskId);
    if (activity.type === "approval_resolved") pending.delete(activity.taskId);
  }
  return pending;
}

/** Task 상태에 해당하는 서류 종류 (사람의 판단이 필요 없으면 undefined) */
export function deskDocumentKind(
  task: Task,
  hasPendingApproval: boolean,
): DeskDocumentKind | undefined {
  switch (task.status) {
    case "needs_input":
      return hasPendingApproval ? "permission" : "question";
    case "failed":
      return "failure";
    case "blocked":
      return "supplement";
    case "needs_review":
      return "draft";
    default:
      return undefined;
  }
}

/** 결재함 서류 목록 (막고 있는 종류 먼저, 같은 종류는 오래 기다린 순) */
export function buildDeskItems(tasks: Task[], activities: ActivityLog[]): DeskItem[] {
  const pendingApproval = tasksWithPendingApproval(activities);
  const items: DeskItem[] = [];
  for (const task of tasks) {
    const kind = deskDocumentKind(task, pendingApproval.has(task.id));
    if (kind) items.push({ kind, task, waitingSince: task.updatedAt });
  }
  return items.sort(
    (a, b) =>
      DESK_PRIORITY.indexOf(a.kind) - DESK_PRIORITY.indexOf(b.kind) ||
      a.waitingSince.localeCompare(b.waitingSince),
  );
}

/** 기다린 시간 표시 ("방금", "12분", "3시간", "2일") */
export function formatWaited(since: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(since).getTime()) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}
