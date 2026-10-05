import type { Agent } from "@ai-pixel-office/domain/entities";

export type OrgTeam<T extends { id: string }> = { team: T; members: Agent[] };

/** 동료를 출처 Team별로 묶음 (Team으로 만들지 않은 동료는 unaffiliated) */
export function groupAgentsByTeam<T extends { id: string }>(
  agents: Agent[],
  teams: T[],
): { teams: Array<OrgTeam<T>>; unaffiliated: Agent[] } {
  const isMemberOf = (agent: Agent, teamId: string) =>
    agent.sourceTeam?.startsWith(`${teamId}@`) ?? false;
  return {
    teams: teams.map((team) => ({
      team,
      members: agents.filter((agent) => isMemberOf(agent, team.id)),
    })),
    unaffiliated: agents.filter((agent) => !teams.some((team) => isMemberOf(agent, team.id))),
  };
}
