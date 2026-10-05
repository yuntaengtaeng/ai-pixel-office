import type { Agent, LeadPlan, Task } from "@ai-pixel-office/domain/entities";
import { planOverview, planProgress } from "../utils/leadView.ts";
import { PlanCard } from "./PlanCard.tsx";
import { PlanDecision } from "./PlanDecision.tsx";

/** 팀장이 올린 계획서 (결재 전에는 받을 것과 규모, 결재 뒤에는 기안마다 상태와 할 일) */
export function LeadPlanCard({
  plan,
  agents,
  tasks,
  onDecided,
}: {
  plan: LeadPlan;
  agents: Agent[];
  /** 이 프로젝트의 기안서 */
  tasks: Task[];
  onDecided: () => void;
}) {
  const overview = planOverview(plan, agents);
  const closed = plan.status === "rejected";
  const progress = plan.status === "approved" ? planProgress(plan, tasks) : [];
  const doneCount = progress.filter((entry) => entry.state === "완료").length;
  return (
    <PlanCard closed={closed}>
      <PlanCard.Main>
        <PlanCard.Header
          eyebrow={`${plan.title} · 팀장의 계획서`}
          title={plan.status === "approved" ? "진행 상황" : "끝나면 이걸 받아요"}
          badge={closed ? (plan.feedback ? "반려" : "진행 안 함") : undefined}
        />
        <PlanCard.Order order={overview.order} reason={plan.reason} />
        <PlanCard.Deliverables items={overview.deliverables} progress={progress} />
      </PlanCard.Main>
      <PlanCard.Aside
        facts={
          plan.status === "approved"
            ? [{ label: "완료", value: `${doneCount} / ${progress.length}` }]
            : [
                { label: "기안", value: `${overview.deliverables.length}개` },
                { label: "파일이 바뀌는 기안", value: `${overview.fileChangingCount}개` },
                {
                  label: "내가 확인할 때",
                  value: overview.checkpoints.length ? overview.checkpoints.join(", ") : "없음",
                },
              ]
        }
      >
        <PlanDecision plan={plan} onDecided={onDecided} />
      </PlanCard.Aside>
    </PlanCard>
  );
}
