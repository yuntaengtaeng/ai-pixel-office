import type { Input, Task } from "../../../../../packages/domain/src/entities.ts";
import { post, request } from "../../shared/api/client.ts";

export const inputApi = {
  list: (workspaceId: string, status = "inbox") =>
    request<Input[]>(
      `/api/inputs?workspaceId=${encodeURIComponent(workspaceId)}&status=${encodeURIComponent(status)}`,
    ),
  create: (input: { workspaceId: string; content: string; title?: string; type?: Input["type"] }) =>
    post<Input>("/api/inputs", input),
  update: (id: string, input: Partial<Pick<Input, "title" | "content" | "type" | "status">>) =>
    request<Input>(`/api/inputs/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/api/inputs/${id}`, { method: "DELETE" }),
  convert: (
    id: string,
    input?: {
      title?: string;
      description?: string;
      assigneeAgentId?: string;
      priority?: "low" | "medium" | "high";
      projectId?: string;
    },
  ) => post<{ input: Input; task: Task }>(`/api/inputs/${id}/convert`, input ?? {}),
};
