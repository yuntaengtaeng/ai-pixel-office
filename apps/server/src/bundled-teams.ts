import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DomainError,
  isResultFormat,
  type Agent,
  type AgentModel,
  type AgentPermissions,
  type CreateAgentInput,
  type ResultFormat,
} from "@ai-pixel-office/domain";
import type { Repository } from "./repository/index.ts";
import type { SkillLibrary } from "./skill-library.ts";

export type BundledTeamMember = {
  key: string;
  name: string;
  role: string;
  avatarId: string;
  description: string;
  permissions: AgentPermissions;
  skills: string[];
  systemPrompt: string;
};

export type BundledTeam = {
  id: string;
  version: string;
  name: string;
  description: string;
  skillCategory: string;
  members: BundledTeamMember[];
  /** 이 팀이 보통 일하는 순서 (프로젝트 팀장이 일을 나눌 때 읽는 안내) */
  workflowGuides: WorkflowGuide[];
  /** team.json과 skills 폴더가 있는 경로 */
  directory: string;
};

export type WorkflowGuideStep = {
  /** team.json members[].key */
  member: string;
  resultFormat?: ResultFormat;
  modifiesFiles: boolean;
};

export type WorkflowGuide = { name: string; steps: WorkflowGuideStep[] };

export type TeamInstallResult = { alreadyInstalled: boolean; agents: Agent[] };

/** `<root>/<teamId>/team.json` 형태의 bundled Team 목록 조회 */
export function loadBundledTeams(root: string): BundledTeam[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "team.json")))
    .map((entry) => {
      const directory = join(root, entry.name);
      return parseBundledTeam(
        JSON.parse(readFileSync(join(directory, "team.json"), "utf8")),
        directory,
      );
    });
}

/** team.json workflow 해석 (stages 형식, 또는 담당 key만 나열한 members 형식) */
function parseWorkflowGuide(value: unknown): WorkflowGuide {
  const workflow = value as {
    name?: unknown;
    stages?: Array<{ member?: unknown; contract?: unknown; modifiesFiles?: unknown }>;
    members?: unknown;
  };
  const name = typeof workflow.name === "string" ? workflow.name : "";
  if (Array.isArray(workflow.stages)) {
    return {
      name,
      steps: workflow.stages.map((stage) => ({
        member: String(stage.member ?? ""),
        ...(isResultFormat(stage.contract) ? { resultFormat: stage.contract } : {}),
        modifiesFiles: stage.modifiesFiles !== false,
      })),
    };
  }
  const members = Array.isArray(workflow.members) ? workflow.members.map(String) : [];
  return { name, steps: members.map((member) => ({ member, modifiesFiles: true })) };
}

export function parseBundledTeam(value: unknown, directory: string): BundledTeam {
  const team = value as Partial<BundledTeam>;
  const members = Array.isArray(team.members) ? team.members : [];
  if (!team.id || !team.version || !team.name || members.length === 0) {
    throw new DomainError("INVALID_TEAM_PACKAGE", `Invalid team package: ${directory}`);
  }
  const memberKeys = new Set(members.map((member) => member.key));
  const rawWorkflows = (value as { workflows?: unknown }).workflows;
  const workflowGuides = (Array.isArray(rawWorkflows) ? rawWorkflows : []).map(parseWorkflowGuide);
  for (const guide of workflowGuides) {
    const unknown = guide.steps.map((step) => step.member).filter((key) => !memberKeys.has(key));
    if (unknown.length > 0) {
      throw new DomainError(
        "INVALID_TEAM_PACKAGE",
        `Unknown workflow members: ${unknown.join(", ")}`,
      );
    }
  }
  return {
    id: team.id,
    version: team.version,
    name: team.name,
    description: team.description ?? "",
    skillCategory: team.skillCategory ?? team.name,
    members,
    workflowGuides,
    directory,
  };
}

/** 설치한 팀이 보통 일하는 순서 ("화면 개선 요청: UX Designer → UI Designer → Developer") */
export function workGuideLines(teams: BundledTeam[], agents: Agent[]): string[] {
  return teams
    .filter((team) => agents.some((agent) => agent.sourceTeam?.startsWith(`${team.id}@`)))
    .flatMap((team) =>
      team.workflowGuides.map((guide) => {
        const roles = guide.steps.map(
          (step) => team.members.find((member) => member.key === step.member)?.role ?? step.member,
        );
        return `${guide.name}: ${roles.join(" → ")}`;
      }),
    );
}

/** 이 Team으로 만든 동료에 기록하는 출처 ("teamId@version") */
export function teamSourceTag(team: Pick<BundledTeam, "id" | "version">): string {
  return `${team.id}@${team.version}`;
}

/** Team 구성원을 workspace에 만들 동료 입력으로 변환 */
export function planTeamAgents(
  team: BundledTeam,
  workspaceId: string,
  runtime: AgentModel,
): Array<CreateAgentInput & { key: string }> {
  return team.members.map((member) => ({
    key: member.key,
    workspaceId,
    name: member.name,
    role: member.role,
    description: member.description,
    model: runtime,
    avatarId: member.avatarId,
    permissions: member.permissions,
    skillIds: member.skills,
    systemPrompt: member.systemPrompt,
    sourceTeam: teamSourceTag(team),
  }));
}

/**
 * Team 설치: 스킬을 라이브러리에 설치하고 workspace에 동료 생성
 * (같은 Team으로 만든 동료가 이미 있으면 아무것도 만들지 않고 기존 동료 반환)
 */
export async function installBundledTeam(
  team: BundledTeam,
  target: { workspaceId: string; runtime: AgentModel },
  dependencies: { repository: Repository; skillLibrary: SkillLibrary },
): Promise<TeamInstallResult> {
  const { repository, skillLibrary } = dependencies;
  const existing = await repository.listAgentsBySourceTeam(target.workspaceId, `${team.id}@`);
  if (existing.length > 0) {
    return { alreadyInstalled: true, agents: existing };
  }

  const skillIds = new Set(team.members.flatMap((member) => member.skills));
  for (const skillId of skillIds) {
    skillLibrary.installBundled(join(team.directory, "skills", skillId), {
      teamId: team.id,
      version: team.version,
      category: team.skillCategory,
    });
  }

  const agentByKey = new Map<string, Agent>();
  for (const { key, ...input } of planTeamAgents(team, target.workspaceId, target.runtime)) {
    agentByKey.set(key, await repository.createAgent(input));
  }

  return { alreadyInstalled: false, agents: [...agentByKey.values()] };
}
