import type { AgentPermissions, Skill, SkillDetail } from "@ai-pixel-office/domain/entities";
import { post, request } from "../../shared/api/client.ts";

export type SkillDraft = {
  id: string;
  title: string;
  category: string;
  description: string;
  instructions: string;
  requiredPermissions: Array<keyof AgentPermissions>;
};

export const skillApi = {
  list: () => request<Skill[]>("/api/skills"),
  get: (id: string) => request<SkillDetail>(`/api/skills/${encodeURIComponent(id)}`),
  create: (input: {
    id?: string;
    title: string;
    category: string;
    description: string;
    instructions: string;
    requiredPermissions: string[];
  }) => post<SkillDetail>("/api/skills", input),
  remove: (id: string) =>
    request<void>(`/api/skills/${encodeURIComponent(id)}`, { method: "DELETE" }),
  generateDraft: (brief: string) => post<SkillDraft>("/api/skills/draft", { brief }),
};
