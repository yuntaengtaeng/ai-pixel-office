import type { Agent, LeadPlan, Task } from "@ai-pixel-office/domain/entities";
import type { LeadConversation } from "../api.ts";

export type LeadPose = "idle" | "plan" | "wait";

/** 팀장 슬라임의 모양 (답을 쓰는 중이면 계획 중, 결재할 계획서가 있으면 결재 기다림) */
export function leadPoseOf(conversation: Pick<LeadConversation, "replying" | "plans">): LeadPose {
  if (conversation.replying) return "plan";
  if (conversation.plans.some((plan) => plan.status === "proposed")) return "wait";
  return "idle";
}

/** 대화 속 팀장 답 옆의 슬라임 모양 (쓰는 중, 결재를 기다리는 계획서, 그 밖) */
export function replyPoseOf(
  replyStatus: "pending" | "done" | "failed",
  planStatus: LeadPlan["status"] | undefined,
): LeadPose {
  if (replyStatus === "pending") return "plan";
  return planStatus === "proposed" ? "wait" : "idle";
}

export type PlanDeliverable = {
  key: string;
  deliverable: string;
  title: string;
  assigneeName: string;
  modifiesFiles: boolean;
  reviewBeforeNext: boolean;
};

export type PlanOverview = {
  deliverables: PlanDeliverable[];
  /** 담당 순서 ("라떼 → 단풍") */
  order: string;
  fileChangingCount: number;
  /** 사람이 확인하는 때 (내가 보고 넘김 기안과, 파일이 바뀌면 마지막 결재) */
  checkpoints: string[];
};

/** 계획서 카드에 보여줄 내용 (받을 것, 담당 순서, 규모, 내가 확인할 때) */
export function planOverview(plan: LeadPlan, agents: Agent[]): PlanOverview {
  const nameOf = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? "담당";
  const deliverables = plan.items.map((item) => ({
    key: item.key,
    deliverable: item.deliverable,
    title: item.title,
    assigneeName: nameOf(item.agentId),
    modifiesFiles: item.modifiesFiles,
    reviewBeforeNext: item.reviewBeforeNext,
  }));
  const reviewed = deliverables
    .filter((item) => item.reviewBeforeNext)
    .map((item) => `${item.deliverable} 받았을 때`);
  const fileChangingCount = deliverables.filter((item) => item.modifiesFiles).length;
  return {
    deliverables,
    order: deliverables.map((item) => item.assigneeName).join(" → "),
    fileChangingCount,
    checkpoints: [...reviewed, ...(fileChangingCount > 0 ? ["바뀐 파일 결재"] : [])],
  };
}

export type PlanItemProgress = {
  key: string;
  task?: Task;
  /** 사람이 지금 할 일 (없으면 기다리기만 하면 됨) */
  nextAction?: string;
  /** 지금 상태 한 줄 */
  state: string;
  /** 표시 단계 (끝남, 지금 하는 중이거나 사람 차례, 아직) */
  phase: "done" | "active" | "waiting";
};

function progressOf(task: Task | undefined): Omit<PlanItemProgress, "key" | "task"> {
  if (!task) return { state: "기안서를 찾을 수 없어요", phase: "waiting" };
  if (task.status === "todo")
    return { state: task.queuedBehind ? "순서 대기" : "시작 전", phase: "waiting" };
  if (task.status === "working") return { state: "진행 중", phase: "active" };
  if (task.status === "needs_input")
    return { state: "질문이 있어요", nextAction: "질문에 답하기", phase: "active" };
  if (task.status === "needs_review")
    return { state: "결재 대기", nextAction: "결과 보고 결재하기", phase: "active" };
  if (task.status === "blocked")
    return { state: "멈춤", nextAction: "멈춘 이유 보기", phase: "active" };
  if (task.status === "failed")
    return { state: "실패", nextAction: "다시 시도하기", phase: "active" };
  return { state: "완료", phase: "done" };
}

/** 결재한 계획서의 기안마다 기안서 상태와 사람이 할 일 (계획서 안에서 같은 제목의 기안서로 이어 봄) */
export function planProgress(plan: LeadPlan, tasks: Task[]): PlanItemProgress[] {
  const planTasks = tasks.filter((task) => task.planId === plan.id);
  return plan.items.map((item) => {
    const task = planTasks.find((candidate) => candidate.title === item.title);
    return { key: item.key, task, ...progressOf(task) };
  });
}

/** 이 프로젝트 팀장의 계획서에서 만든 기안서 (최근 것부터) */
export function delegatedTasks(tasks: Task[], plans: LeadPlan[]): Task[] {
  const planIds = new Set(plans.map((plan) => plan.id));
  return tasks
    .filter((task) => task.planId && planIds.has(task.planId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
