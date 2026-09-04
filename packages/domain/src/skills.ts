import { DomainError } from "./errors.ts";
import type { Agent, Skill, Task } from "./entities.ts";

export function assertSkillsRunnable(agent: Agent, skills: Skill[]): void {
  const resolved = new Set(skills.map((skill) => skill.id));
  const missingSkills = agent.skillIds.filter((skillId) => !resolved.has(skillId));
  if (missingSkills.length > 0) {
    throw new DomainError(
      "SKILLS_NOT_FOUND",
      `Agent references missing skills: ${missingSkills.join(", ")}`,
      422,
    );
  }

  const missingPermissions = new Set<string>();
  for (const skill of skills) {
    for (const permission of skill.requiredPermissions ?? []) {
      if (agent.permissions[permission] !== true) missingPermissions.add(permission);
    }
  }
  if (missingPermissions.size > 0) {
    throw new DomainError(
      "MISSING_PERMISSIONS",
      `Agent is missing required permissions: ${[...missingPermissions].join(", ")}`,
      422,
    );
  }
}

export function compileAgentInstructions(agent: Agent, skills: Skill[], task: Task): string {
  assertSkillsRunnable(agent, skills);
  const skillSections = skills
    .map(
      (skill) =>
        `SKILL: ${skill.name.toUpperCase()}\n${skill.instructions.trim()}\n\nEXPECTED TOOLS\n${
          skill.tools.map((tool) => `- ${tool.name}`).join("\n") || "- none"
        }`,
    )
    .join("\n\n");

  return [
    "SYSTEM",
    agent.systemPrompt?.trim() || `You are ${agent.name}.`,
    agent.mode === "chat"
      ? "This is a conversational task. Answer directly and do not use files or terminal tools."
      : "",
    "",
    "ROLE",
    agent.role.trim(),
    agent.description?.trim() || "",
    "",
    skillSections,
    "",
    "TASK",
    task.title.trim(),
    task.description?.trim() || "",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .trim();
}
