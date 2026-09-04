import type { AgentPermissions, Skill } from "@ai-pixel-office/domain/entities";
import { post, request } from "../../shared/api/client.ts";

export type SkillDraft = {
  name: string;
  category: string;
  description: string;
  instructions: string;
  tools: string[];
  requiredPermissions: Array<keyof AgentPermissions>;
};

export const skillApi = {
  list: (workspaceId: string) =>
    request<Skill[]>(`/api/skills?workspaceId=${encodeURIComponent(workspaceId)}`),
  create: (input: {
    workspaceId: string;
    name: string;
    category: string;
    description: string;
    instructions: string;
    tools: Array<{ name: string }>;
    requiredPermissions: string[];
  }) => post<Skill>("/api/skills", input),
  remove: (id: string) => request<void>(`/api/skills/${id}`, { method: "DELETE" }),
  generateDraft: (brief: string) => post<SkillDraft>("/api/skills/draft", { brief }),
};
