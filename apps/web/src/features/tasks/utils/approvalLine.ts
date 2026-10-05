import type { Agent, Task } from "@ai-pixel-office/domain/entities";

export type ApprovalCellState = "stamped" | "working" | "failed" | "waiting" | "mine";

export type ApprovalCell = {
  key: string;
  /** 칸 머리글 (담당 역할 또는 "승인") */
  heading: string;
  /** 도장에 새길 이름 */
  stampName: string;
  state: ApprovalCellState;
};

function assigneeState(status: Task["status"]): ApprovalCellState {
  if (status === "needs_review" || status === "done") return "stamped";
  if (status === "failed") return "failed";
  if (status === "todo") return "waiting";
  return "working";
}

function finalApprovalState(status: Task["status"]): ApprovalCellState {
  if (status === "done") return "stamped";
  if (status === "needs_review") return "mine";
  return "waiting";
}

/** 기안서 결재란 칸 목록 (담당 칸 다음에 마지막 "승인" 칸) */
export function approvalLineCells(
  task: Pick<Task, "status" | "assigneeAgentId">,
  agents: Agent[],
): ApprovalCell[] {
  const assignee = agents.find((agent) => agent.id === task.assigneeAgentId);
  const assigneeCells: ApprovalCell[] = task.assigneeAgentId
    ? [
        {
          key: task.assigneeAgentId,
          heading: assignee?.role ?? "담당",
          stampName: assignee?.name ?? "담당",
          state: assigneeState(task.status),
        },
      ]
    : [];
  return [
    ...assigneeCells,
    { key: "final", heading: "승인", stampName: "결재", state: finalApprovalState(task.status) },
  ];
}
