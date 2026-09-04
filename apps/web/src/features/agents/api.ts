import type {
  Agent,
  AgentPermissions,
  AgentTaskTemplate,
} from "../../../../../packages/domain/src/entities.ts";
import { post, request } from "../../shared/api/client.ts";

export const agentApi = {
  list: (workspaceId: string) =>
    request<Agent[]>(`/api/agents?workspaceId=${encodeURIComponent(workspaceId)}`),
  create: (input: {
    workspaceId: string;
    name: string;
    role: string;
    description?: string;
    model: "codex" | "claude";
    modelPolicy?: Agent["modelPolicy"];
    modelName?: string;
    reasoningEffort?: Agent["reasoningEffort"];
    mode?: "worker" | "chat";
    avatarId: string;
    skillIds: string[];
    permissions: AgentPermissions;
    workingDirectory?: string;
  }) => post<Agent>("/api/agents", input),
  get: (id: string) => request<Agent>(`/api/agents/${id}`),
  update: (
    id: string,
    input: Partial<
      Pick<
        Agent,
        | "name"
        | "role"
        | "description"
        | "model"
        | "modelPolicy"
        | "modelName"
        | "reasoningEffort"
        | "mode"
        | "avatarId"
        | "skillIds"
        | "permissions"
        | "systemPrompt"
        | "workingDirectory"
      >
    >,
  ) => request<Agent>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/api/agents/${id}`, { method: "DELETE" }),
  listTaskTemplates: (agentId: string) =>
    request<AgentTaskTemplate[]>(`/api/agents/${agentId}/task-templates`),
  createTaskTemplate: (
    agentId: string,
    input: { title: string; description?: string; priority?: "low" | "medium" | "high" },
  ) => post<AgentTaskTemplate>(`/api/agents/${agentId}/task-templates`, input),
  deleteTaskTemplate: (agentId: string, templateId: string) =>
    request<void>(`/api/agents/${agentId}/task-templates/${templateId}`, { method: "DELETE" }),
};
