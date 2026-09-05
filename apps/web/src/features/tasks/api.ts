import type {
  AgentRun,
  KnowledgeDocument,
  RunProgressEvent,
  Task,
  TaskReview,
  TaskWorkflowStep,
} from "@ai-pixel-office/domain/entities";
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
  list: (workspaceId: string, origin?: Task["origin"]) =>
    request<Task[]>(
      `/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}${origin ? `&origin=${origin}` : ""}`,
    ),
  create: (input: {
    workspaceId: string;
    title: string;
    description?: string;
    assigneeAgentId?: string;
    priority?: "low" | "medium" | "high";
    projectId?: string;
    origin?: Task["origin"];
  }) => post<Task>("/api/tasks", input),
  get: (id: string) => request<TaskDetail>(`/api/tasks/${id}`),
  executionContexts: (id: string) =>
    request<TaskExecutionContext[]>(`/api/tasks/${id}/execution-context`),
  update: (
    id: string,
    input: Partial<
      Pick<Task, "title" | "description" | "assigneeAgentId" | "priority" | "projectId">
    >,
  ) => request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  run: (id: string) => post<AgentRun>(`/api/tasks/${id}/run`, {}),
  createDocument: (id: string) => post<KnowledgeDocument>(`/api/tasks/${id}/document`, {}),
  retry: (id: string) => post<AgentRun>(`/api/tasks/${id}/retry`, {}),
  continue: (id: string) => post<AgentRun>(`/api/tasks/${id}/continue`, {}),
  extendSession: (id: string) => post<AgentRun>(`/api/tasks/${id}/extend-session`, {}),
  approve: (id: string) => post<Task>(`/api/tasks/${id}/approve`, {}),
  requestChanges: (id: string, feedback: string) =>
    post<AgentRun>(`/api/tasks/${id}/request-changes`, { feedback }),
  sendMessage: (id: string, message: string) =>
    post<AgentRun>(`/api/tasks/${id}/messages`, { message }),
  cancelRun: (id: string) => post<AgentRun>(`/api/runs/${id}/cancel`, {}),
  resolveApproval: (runId: string, requestId: string, decision: "accept" | "cancel") =>
    post<AgentRun>(`/api/runs/${runId}/approvals/${requestId}`, { decision }),
};
