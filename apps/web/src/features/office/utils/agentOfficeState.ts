import type { Agent, Task, TaskStatus } from "@ai-pixel-office/domain/entities";

export function agentOfficeState(
  agent: Agent,
  tasks: Task[],
): { latestTask?: Task; task?: Task; status: TaskStatus | "idle" } {
  const activeTask = tasks.find(
    (task) => task.assigneeAgentId === agent.id && task.status !== "done",
  );
  const latestTask = activeTask ?? tasks.find((task) => task.assigneeAgentId === agent.id);
  return { latestTask, task: activeTask, status: activeTask?.status ?? "idle" };
}

export type OfficeStatusGroup = "idle" | "active" | "attention";

const ATTENTION_STATUSES = new Set<TaskStatus>([
  "needs_review",
  "needs_input",
  "blocked",
  "failed",
]);

export function officeStatusGroup(status: TaskStatus | "idle"): OfficeStatusGroup {
  if (status === "idle") return "idle";
  if (ATTENTION_STATUSES.has(status)) return "attention";
  return "active";
}

export const OFFICE_STATUS_GROUP_META: Record<OfficeStatusGroup, { label: string; color: string }> = {
  idle: { label: "쉬는 중", color: "rgb(109 83 71 / 42%)" },
  active: { label: "진행 중", color: "#628275" },
  attention: { label: "주의 필요", color: "#8b68b5" },
};
