import type {
  AgentRun,
  RunProgressEvent,
  Task,
  TaskReview,
  TaskWorkflowStep,
} from "../../../../../packages/domain/src/entities.ts";
import { post, request } from "../../shared/api/client.ts";

export type TaskDetail = Task & {
  runs: AgentRun[];
  reviews: TaskReview[];
  progress: RunProgressEvent[];
  progressByRun: Record<string, RunProgressEvent[]>;
  workflow: TaskWorkflowStep[];
};

export type TaskExecutionContext = {
  agentId: string;
  agentName: string;
  runtime: AgentRun["runtime"];
  workingDirectory: string;
  workflowStepId?: string;
  position?: number;
  instructionFiles: string[];
  projectSkills: Array<{ name: string; path: string }>;
};

export const taskApi = {
  list: (workspaceId: string) =>
    request<Task[]>(`/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}`),
  create: (input: {
    workspaceId: string;
    title: string;
    description?: string;
    assigneeAgentId?: string;
    priority?: "low" | "medium" | "high";
    projectId?: string;
    workingDirectory?: string;
  }) => post<Task>("/api/tasks", input),
  get: (id: string) => request<TaskDetail>(`/api/tasks/${id}`),
  executionContexts: (id: string) =>
    request<TaskExecutionContext[]>(`/api/tasks/${id}/execution-context`),
  update: (
    id: string,
    input: Partial<
      Pick<
        Task,
        "title" | "description" | "assigneeAgentId" | "priority" | "projectId" | "workingDirectory"
      >
    >,
  ) => request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  run: (id: string) => post<AgentRun>(`/api/tasks/${id}/run`, {}),
  retry: (id: string) => post<AgentRun>(`/api/tasks/${id}/retry`, {}),
  continue: (id: string) => post<AgentRun>(`/api/tasks/${id}/continue`, {}),
  extendSession: (id: string) => post<AgentRun>(`/api/tasks/${id}/extend-session`, {}),
  approve: (id: string) => post<Task>(`/api/tasks/${id}/approve`, {}),
  requestChanges: (id: string, feedback: string) =>
    post<AgentRun>(`/api/tasks/${id}/request-changes`, { feedback }),
  cancelRun: (id: string) => post<AgentRun>(`/api/runs/${id}/cancel`, {}),
  resolveApproval: (runId: string, requestId: string, decision: "accept" | "cancel") =>
    post<AgentRun>(`/api/runs/${runId}/approvals/${requestId}`, { decision }),
};
