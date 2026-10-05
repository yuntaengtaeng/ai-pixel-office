import type { Agent, Task, TaskStatus } from "@ai-pixel-office/domain/entities";
import { isAwaitingUser } from "@ai-pixel-office/domain/task-state";
import { OFFICE_PALETTE } from "./officePalette.ts";

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

export function officeStatusGroup(status: TaskStatus | "idle"): OfficeStatusGroup {
  if (status === "idle") return "idle";
  if (isAwaitingUser(status)) return "attention";
  return "active";
}

export const OFFICE_STATUS_GROUP_META: Record<OfficeStatusGroup, { label: string; color: string }> =
  {
    idle: { label: "쉬는 중", color: OFFICE_PALETTE.idle },
    active: { label: "진행 중", color: OFFICE_PALETTE.working },
    attention: { label: "주의 필요", color: OFFICE_PALETTE.attention },
  };
