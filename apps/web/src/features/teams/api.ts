import type { Agent, AgentModel } from "@ai-pixel-office/domain/entities";
import { post, request } from "../../shared/api/client.ts";

export type TeamMemberSummary = {
  key: string;
  name: string;
  role: string;
  avatarId: string;
  description: string;
};

export type TeamSummary = {
  id: string;
  version: string;
  name: string;
  description: string;
  members: TeamMemberSummary[];
  /** 이 팀이 보통 일하는 순서 */
  workflowGuides: Array<{ name: string; steps: Array<{ member: string }> }>;
  installed: boolean;
};

export type TeamInstallResult = {
  alreadyInstalled: boolean;
  agents: Agent[];
};

export const teamApi = {
  list: (workspaceId: string) =>
    request<TeamSummary[]>(`/api/teams?workspaceId=${encodeURIComponent(workspaceId)}`),
  install: (teamId: string, input: { workspaceId: string; runtime: AgentModel }) =>
    post<TeamInstallResult>(`/api/teams/${encodeURIComponent(teamId)}/install`, input),
};

/** 팀을 만들 때 쓸 런타임 선택 (연결된 런타임 중 Claude 우선, 없으면 undefined) */
export function chooseTeamRuntime(connected: AgentModel[]): AgentModel | undefined {
  if (connected.includes("claude")) return "claude";
  return connected[0];
}
