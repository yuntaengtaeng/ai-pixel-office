import type { Agent, Project, Skill, SkillSource, Task } from "@ai-pixel-office/domain/entities";
import { josa } from "../../../shared/lib/korean.ts";

export type SkillSourceFilter = "all" | SkillSource;

export const SKILL_SOURCE_LABEL: Record<SkillSource, string> = {
  bundled: "팀 설치",
  local: "내가 만든 것",
  imported: "가져온 것",
};

export const SKILL_SOURCE_FILTERS: SkillSourceFilter[] = ["all", "bundled", "local", "imported"];

export function filterSkillsBySource(skills: Skill[], filter: SkillSourceFilter): Skill[] {
  return filter === "all" ? skills : skills.filter((skill) => skill.source === filter);
}

/** 스킬 id별로 그 스킬을 쓰는 동료 목록 */
export function agentsBySkill(agents: Agent[]): Map<string, Agent[]> {
  const usage = new Map<string, Agent[]>();
  for (const agent of agents) {
    for (const skillId of agent.skillIds)
      usage.set(skillId, [...(usage.get(skillId) ?? []), agent]);
  }
  return usage;
}

/** 스킬 id별로 그 스킬을 쓰는 동료가 기안서를 맡은 프로젝트 (이름순) */
export function projectsBySkill(
  agents: Agent[],
  tasks: Task[],
  projects: Project[],
): Map<string, Project[]> {
  const skillIdsOfAgent = new Map(agents.map((agent) => [agent.id, agent.skillIds]));
  const projectIdsBySkill = new Map<string, Set<string>>();
  for (const task of tasks) {
    if (!task.projectId || !task.assigneeAgentId) continue;
    for (const skillId of skillIdsOfAgent.get(task.assigneeAgentId) ?? []) {
      const projectIds = projectIdsBySkill.get(skillId) ?? new Set<string>();
      projectIds.add(task.projectId);
      projectIdsBySkill.set(skillId, projectIds);
    }
  }
  const byName = [...projects].sort((left, right) => left.name.localeCompare(right.name, "ko"));
  return new Map(
    [...projectIdsBySkill].map(([skillId, projectIds]) => [
      skillId,
      byName.filter((project) => projectIds.has(project.id)),
    ]),
  );
}

/** 스킬 삭제 가능 여부 (Team이 설치한 스킬과 동료가 쓰는 스킬은 삭제 불가) */
export function skillRemovalBlocker(skill: Skill, usedBy: Agent[]): string | undefined {
  if (skill.source === "bundled") return "팀과 함께 설치된 스킬은 지울 수 없어요";
  if (usedBy.length > 0) {
    const names = usedBy.map((agent) => agent.name).join(", ");
    return `${names}${josa(names, "이/가")} 쓰고 있어요`;
  }
  return undefined;
}
