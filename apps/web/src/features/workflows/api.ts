import type {
  TaskWorkflowStep,
  WorkflowPreset,
} from "../../../../../packages/domain/src/entities.ts";
import { post, request } from "../../shared/api/client.ts";

export const workflowApi = {
  setTaskWorkflow: (taskId: string, agentIds: string[]) =>
    request<TaskWorkflowStep[]>(`/api/tasks/${taskId}/workflow`, {
      method: "PUT",
      body: JSON.stringify({ agentIds }),
    }),
  listPresets: (workspaceId: string) =>
    request<WorkflowPreset[]>(
      `/api/workflow-presets?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
  createPreset: (input: { workspaceId: string; name: string; agentIds: string[] }) =>
    post<WorkflowPreset>("/api/workflow-presets", input),
  deletePreset: (id: string) => request<void>(`/api/workflow-presets/${id}`, { method: "DELETE" }),
};
