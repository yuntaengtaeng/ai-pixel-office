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
