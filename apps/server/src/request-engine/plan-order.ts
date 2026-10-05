import type { Task } from "@ai-pixel-office/domain";

/** 앞 기안이 모두 끝나 이제 시작할 수 있는 기안서 (아직 시작 전인 것만, 순서 대기 중이어도 포함) */
export function readyPlanTasks(planTasks: Task[]): Task[] {
  const doneIds = new Set(
    planTasks.filter((task) => task.status === "done").map((task) => task.id),
  );
  return planTasks.filter(
    (task) => task.status === "todo" && (task.waitsFor ?? []).every((id) => doneIds.has(id)),
  );
}

/** 앞 기안이 아직 끝나지 않아 기다리는 기안서인지 */
export function isWaitingForEarlierRequests(task: Task, planTasks: Task[]): boolean {
  const doneIds = new Set(
    planTasks.filter((candidate) => candidate.status === "done").map((candidate) => candidate.id),
  );
  return (task.waitsFor ?? []).some((id) => !doneIds.has(id));
}
