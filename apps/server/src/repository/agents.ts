import { randomUUID } from "node:crypto";
import {
  DomainError,
  type Agent,
  type AgentTaskTemplate,
  type CreateAgentInput,
  type CreateAgentTaskTemplateInput,
  type UpdateAgentInput,
} from "@ai-pixel-office/domain";
import { UNLOCKABLE_PETS, isPetId } from "@ai-pixel-office/pet";
import { requireEntity } from "../database.ts";
import type { AppDatabase } from "../database.ts";
import { agentFrom, now, type Row, taskTemplateFrom } from "./rows.ts";
import { requireChanged, withTransaction } from "./shared.ts";
import { createActivity } from "./activities.ts";
import { getSkill } from "./skills.ts";
import { getWorkspace } from "./workspaces.ts";

export async function listAgents(database: AppDatabase, workspaceId?: string): Promise<Agent[]> {
  const rows = workspaceId
    ? database
        .prepare("SELECT * FROM agents WHERE workspace_id = ? ORDER BY created_at")
        .all(workspaceId)
    : database.prepare("SELECT * FROM agents ORDER BY created_at").all();
  return rows.map((row) => agentFrom(database, row as Row));
}

export async function getAgent(database: AppDatabase, id: string): Promise<Agent | undefined> {
  const row = database.prepare("SELECT * FROM agents WHERE id = ?").get(id);
  return row ? agentFrom(database, row as Row) : undefined;
}

async function assertSkillScope(
  database: AppDatabase,
  workspaceId: string,
  skillIds: string[],
): Promise<void> {
  for (const skillId of skillIds) {
    const skill = requireEntity(await getSkill(database, skillId), "Skill", skillId);
    if (skill.workspaceId && skill.workspaceId !== workspaceId) {
      throw new DomainError(
        "SKILL_SCOPE_MISMATCH",
        `Skill ${skillId} belongs to another workspace`,
        422,
      );
    }
  }
}

function replaceAgentSkills(database: AppDatabase, agentId: string, skillIds: string[]): void {
  database.prepare("DELETE FROM agent_skills WHERE agent_id = ?").run(agentId);
  const insert = database.prepare("INSERT INTO agent_skills (agent_id, skill_id) VALUES (?, ?)");
  for (const skillId of skillIds) insert.run(agentId, skillId);
}

function assertAvatarAvailable(
  database: AppDatabase,
  workspaceId: string,
  avatarId?: string,
): void {
  if (!avatarId) return;
  if (!isPetId(avatarId))
    throw new DomainError("INVALID_AVATAR", "존재하지 않는 캐릭터입니다", 422);
  if (!UNLOCKABLE_PETS.some((pet) => pet.id === avatarId)) return;
  const unlocked = database
    .prepare("SELECT 1 FROM pet_unlocks WHERE workspace_id = ? AND pet_id = ?")
    .get(workspaceId, avatarId);
  if (!unlocked) throw new DomainError("PET_LOCKED", "아직 해금되지 않은 캐릭터입니다", 409);
}

export async function createAgent(database: AppDatabase, input: CreateAgentInput): Promise<Agent> {
  requireEntity(await getWorkspace(database, input.workspaceId), "Workspace", input.workspaceId);
  await assertSkillScope(database, input.workspaceId, input.skillIds);
  const createdAt = now();
  const agent: Agent = {
    id: randomUUID(),
    ...input,
    modelPolicy: input.modelPolicy ?? "default",
    mode: input.mode ?? "worker",
    createdAt,
    updatedAt: createdAt,
  };
  withTransaction(database, () => {
    assertAvatarAvailable(database, agent.workspaceId, agent.avatarId);
    database
      .prepare(
        `INSERT INTO agents
        (id, workspace_id, name, role, description, model, model_policy, model_name, reasoning_effort, mode, avatar_id, permissions_json, system_prompt, working_directory, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        agent.id,
        agent.workspaceId,
        agent.name,
        agent.role,
        agent.description ?? null,
        agent.model,
        agent.modelPolicy ?? "default",
        agent.modelName ?? null,
        agent.reasoningEffort ?? null,
        agent.mode,
        agent.avatarId ?? null,
        JSON.stringify(agent.permissions),
        agent.systemPrompt ?? null,
        agent.workingDirectory ?? null,
        agent.createdAt,
        agent.updatedAt,
      );
    replaceAgentSkills(database, agent.id, agent.skillIds);
  });
  await createActivity(database, {
    workspaceId: agent.workspaceId,
    type: "agent_created",
    agentId: agent.id,
    message: `Agent created: ${agent.name}`,
  });
  return agent;
}

export async function updateAgent(
  database: AppDatabase,
  id: string,
  input: UpdateAgentInput,
): Promise<Agent> {
  const current = requireEntity(await getAgent(database, id), "Agent", id);
  const updated: Agent = { ...current, ...input, updatedAt: now() };
  await assertSkillScope(database, updated.workspaceId, updated.skillIds);
  withTransaction(database, () => {
    if ("avatarId" in input && input.avatarId !== current.avatarId)
      assertAvatarAvailable(database, updated.workspaceId, updated.avatarId);
    database
      .prepare(
        `UPDATE agents SET name = ?, role = ?, description = ?, model = ?, model_policy = ?, model_name = ?, reasoning_effort = ?, mode = ?, avatar_id = ?,
        permissions_json = ?, system_prompt = ?, working_directory = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        updated.name,
        updated.role,
        updated.description ?? null,
        updated.model,
        updated.modelPolicy ?? "default",
        updated.modelName ?? null,
        updated.reasoningEffort ?? null,
        updated.mode,
        updated.avatarId ?? null,
        JSON.stringify(updated.permissions),
        updated.systemPrompt ?? null,
        updated.workingDirectory ?? null,
        updated.updatedAt,
        id,
      );
    replaceAgentSkills(database, id, updated.skillIds);
  });
  return updated;
}

export async function deleteAgent(database: AppDatabase, id: string): Promise<void> {
  try {
    requireChanged(database.prepare("DELETE FROM agents WHERE id = ?").run(id), "Agent", id);
  } catch (error) {
    if (error instanceof Error && error.message.includes("FOREIGN KEY")) {
      throw new DomainError(
        "AGENT_HAS_RUNS",
        "실행 기록이 있는 에이전트는 삭제할 수 없습니다.",
        409,
      );
    }
    throw error;
  }
}

export async function listAgentTaskTemplates(
  database: AppDatabase,
  agentId: string,
): Promise<AgentTaskTemplate[]> {
  requireEntity(await getAgent(database, agentId), "Agent", agentId);
  return database
    .prepare("SELECT * FROM agent_task_templates WHERE agent_id = ? ORDER BY created_at DESC")
    .all(agentId)
    .map((row) => taskTemplateFrom(row as Row));
}

export async function createAgentTaskTemplate(
  database: AppDatabase,
  input: CreateAgentTaskTemplateInput,
): Promise<AgentTaskTemplate> {
  requireEntity(await getAgent(database, input.agentId), "Agent", input.agentId);
  const template: AgentTaskTemplate = {
    id: randomUUID(),
    agentId: input.agentId,
    title: input.title,
    description: input.description,
    priority: input.priority ?? "medium",
    createdAt: now(),
  };
  database
    .prepare(
      `INSERT INTO agent_task_templates
      (id, agent_id, title, description, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      template.id,
      template.agentId,
      template.title,
      template.description ?? null,
      template.priority,
      template.createdAt,
    );
  return template;
}

export async function deleteAgentTaskTemplate(
  database: AppDatabase,
  agentId: string,
  id: string,
): Promise<void> {
  requireChanged(
    database
      .prepare("DELETE FROM agent_task_templates WHERE id = ? AND agent_id = ?")
      .run(id, agentId),
    "AgentTaskTemplate",
    id,
  );
}

export type AgentLookup = (id: string) => Promise<Agent | undefined>;

export async function assertAgentWorkspace(
  database: AppDatabase,
  agentId: string,
  workspaceId: string,
  lookupAgent: AgentLookup = (id) => getAgent(database, id),
): Promise<void> {
  const agent = requireEntity(await lookupAgent(agentId), "Agent", agentId);
  if (agent.workspaceId !== workspaceId) {
    throw new DomainError("AGENT_SCOPE_MISMATCH", "Agent belongs to another workspace", 422);
  }
}
