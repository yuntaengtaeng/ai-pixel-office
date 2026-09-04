import { DomainError, type AgentPermissions } from "@ai-pixel-office/domain";
import { runCodexSpike } from "../../../scripts/runtime-spike/codex.ts";

export type SkillDraft = {
  name: string;
  category: string;
  description: string;
  instructions: string;
  tools: string[];
  requiredPermissions: Array<keyof AgentPermissions>;
};

const permissionNames = new Set<keyof AgentPermissions>([
  "fileRead",
  "fileWrite",
  "terminal",
  "git",
  "browser",
  "figma",
]);

export async function generateSkillDraft(
  brief: string,
  generalWorkingDirectory: string,
): Promise<SkillDraft> {
  const prompt = [
    "Create one reusable AI agent skill from the user's short description.",
    "",
    "USER DESCRIPTION",
    brief,
    "",
    "Return only one JSON object with this exact shape:",
    "{",
    '  "name": "short Korean skill name",',
    '  "category": "Design | Frontend | Engineering | Research | Operations",',
    '  "description": "one concise Korean sentence explaining when to use it",',
    '  "instructions": "clear Korean step-by-step instructions in Markdown",',
    '  "tools": ["tool-name"],',
    '  "requiredPermissions": ["fileRead"]',
    "}",
    "",
    "Allowed permissions: fileRead, fileWrite, terminal, git, browser, figma.",
    "Use an empty tools or permissions array when none are genuinely needed.",
    "Do not run tools and do not wrap the JSON in a Markdown code fence.",
  ].join("\n");
  const result = await runCodexSpike({
    prompt,
    cwd: generalWorkingDirectory,
    approvalPolicy: "never",
    sandbox: "read-only",
    timeoutMs: 60_000,
    logDirectory: false,
  });
  const completion = result.events.findLast((event) => event.type === "completed");
  if (completion?.type !== "completed") {
    throw new DomainError("SKILL_DRAFT_FAILED", "AI가 스킬 초안을 완성하지 못했습니다.", 502);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(completion.result.summary.trim());
  } catch {
    throw new DomainError(
      "SKILL_DRAFT_INVALID",
      "AI가 올바른 스킬 형식을 반환하지 않았습니다. 다시 시도해 주세요.",
      502,
    );
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new DomainError(
      "SKILL_DRAFT_INVALID",
      "AI가 올바른 스킬 형식을 반환하지 않았습니다.",
      502,
    );
  }
  const value = raw as Record<string, unknown>;
  const required = ["name", "category", "description", "instructions"] as const;
  for (const key of required) {
    if (typeof value[key] !== "string" || value[key].trim() === "") {
      throw new DomainError(
        "SKILL_DRAFT_INVALID",
        "AI 스킬 초안에 " + key + " 값이 없습니다.",
        502,
      );
    }
  }
  const tools = Array.isArray(value.tools)
    ? value.tools.filter((tool): tool is string => typeof tool === "string" && tool.trim() !== "")
    : [];
  const requiredPermissions = Array.isArray(value.requiredPermissions)
    ? value.requiredPermissions.filter(
        (permission): permission is keyof AgentPermissions =>
          typeof permission === "string" &&
          permissionNames.has(permission as keyof AgentPermissions),
      )
    : [];
  return {
    name: (value.name as string).trim(),
    category: (value.category as string).trim(),
    description: (value.description as string).trim(),
    instructions: (value.instructions as string).trim(),
    tools: [...new Set(tools)],
    requiredPermissions: [...new Set(requiredPermissions)],
  };
}
