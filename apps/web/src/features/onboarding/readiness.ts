import type { Agent, AgentModel } from "@ai-pixel-office/domain/entities";
import type { SystemStatus } from "../system/api.ts";

export function authenticatedRuntimes(status?: SystemStatus): Set<AgentModel> {
  return new Set(
    (["codex", "claude"] as const).filter((runtime) => status?.[runtime].authenticated),
  );
}

/** 인증 상태와 런타임 필수 권한을 함께 만족하는 실제 실행 가능 Agent 판정 */
export function isRunnableAgent(agent: Agent, status?: SystemStatus): boolean {
  return (
    authenticatedRuntimes(status).has(agent.model) &&
    agent.permissions.fileRead === true &&
    agent.permissions.terminal === true
  );
}

/** Project나 기존 Task 유무와 분리된 dashboard 진입 readiness 판정 */
export function isWorkspaceReady(agents: Agent[] = [], status?: SystemStatus): boolean {
  return agents.some((agent) => isRunnableAgent(agent, status));
}
