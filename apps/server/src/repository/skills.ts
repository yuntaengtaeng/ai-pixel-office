import { randomUUID } from "node:crypto";
import {
  DomainError,
  type CreateSkillInput,
  type Skill,
  type UpdateSkillInput,
} from "@ai-pixel-office/domain";
import { requireEntity } from "../database.ts";
import type { AppDatabase } from "../database.ts";
import { now, type Row, skillFrom } from "./rows.ts";
import { requireChanged } from "./shared.ts";
import { getWorkspace } from "./workspaces.ts";

export async function listSkills(database: AppDatabase, workspaceId?: string): Promise<Skill[]> {
  const rows = workspaceId
    ? database
        .prepare(
          "SELECT * FROM skills WHERE workspace_id IS NULL OR workspace_id = ? ORDER BY category, name",
        )
        .all(workspaceId)
    : database.prepare("SELECT * FROM skills ORDER BY category, name").all();
  return rows.map((row) => skillFrom(row as Row));
}

export async function getSkill(database: AppDatabase, id: string): Promise<Skill | undefined> {
  const row = database.prepare("SELECT * FROM skills WHERE id = ?").get(id);
  return row ? skillFrom(row as Row) : undefined;
}

export async function createSkill(
  database: AppDatabase,
  input: CreateSkillInput,
): Promise<Skill> {
  if (input.workspaceId)
    requireEntity(await getWorkspace(database, input.workspaceId), "Workspace", input.workspaceId);
  const createdAt = now();
  const skill: Skill = { id: randomUUID(), ...input, createdAt, updatedAt: createdAt };
  database
    .prepare(
      `INSERT INTO skills
      (id, workspace_id, name, category, description, instructions, tools_json,
       required_permissions_json, output_schema_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      skill.id,
      skill.workspaceId ?? null,
      skill.name,
      skill.category,
      skill.description,
      skill.instructions,
      JSON.stringify(skill.tools),
      JSON.stringify(skill.requiredPermissions ?? []),
      skill.outputSchema ? JSON.stringify(skill.outputSchema) : null,
      skill.createdAt,
      skill.updatedAt,
    );
  return skill;
}

export async function updateSkill(
  database: AppDatabase,
  id: string,
  input: UpdateSkillInput,
): Promise<Skill> {
  const current = requireEntity(await getSkill(database, id), "Skill", id);
  const updated: Skill = { ...current, ...input, updatedAt: now() };
  database
    .prepare(
      `UPDATE skills SET name = ?, category = ?, description = ?, instructions = ?,
      tools_json = ?, required_permissions_json = ?, output_schema_json = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      updated.name,
      updated.category,
      updated.description,
      updated.instructions,
      JSON.stringify(updated.tools),
      JSON.stringify(updated.requiredPermissions ?? []),
      updated.outputSchema ? JSON.stringify(updated.outputSchema) : null,
      updated.updatedAt,
      id,
    );
  return updated;
}

export async function deleteSkill(database: AppDatabase, id: string): Promise<void> {
  try {
    requireChanged(database.prepare("DELETE FROM skills WHERE id = ?").run(id), "Skill", id);
  } catch (error) {
    if (error instanceof Error && error.message.includes("FOREIGN KEY")) {
      throw new DomainError(
        "SKILL_IN_USE",
        "이 스킬을 사용하는 에이전트가 있습니다. 에이전트 설정에서 스킬 연결을 먼저 해제해 주세요.",
        409,
      );
    }
    throw error;
  }
}
