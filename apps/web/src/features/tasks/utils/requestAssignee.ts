import type { Agent } from "@ai-pixel-office/domain/entities";

/** 새 요청을 받을 수 있는 동료 (이름순) */
export function assignableAgents(agents: Agent[]): Agent[] {
  return [...agents].sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

/** 새 요청의 담당 (직접 고른 동료, 고른 프로젝트의 기본 담당, 첫 동료 순) */
export function pickAssignee(
  agents: Agent[],
  chosenId: string | undefined,
  projectDefaultId: string | undefined,
): Agent | undefined {
  return (
    agents.find((agent) => agent.id === chosenId) ??
    agents.find((agent) => agent.id === projectDefaultId) ??
    agents[0]
  );
}
