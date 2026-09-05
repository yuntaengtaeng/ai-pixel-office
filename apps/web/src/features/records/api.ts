import type { KnowledgeDocument } from "@ai-pixel-office/domain/entities";
import { post, request } from "../../shared/api/client.ts";

export const recordApi = {
  list: (workspaceId: string) =>
    request<KnowledgeDocument[]>(
      `/api/knowledge-documents?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
  create: (input: {
    workspaceId: string;
    title: string;
    content: string;
    taskId?: string;
    runId?: string;
  }) => post<KnowledgeDocument>("/api/knowledge-documents", input),
  update: (
    workspaceId: string,
    id: string,
    input: Partial<
      Pick<KnowledgeDocument, "title" | "content" | "taskId" | "runId" | "referenceTaskIds">
    >,
  ) =>
    request<KnowledgeDocument>(
      `/api/knowledge-documents/${id}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  remove: (workspaceId: string, id: string) =>
    request<void>(`/api/knowledge-documents/${id}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
    }),
  import: (workspaceId: string, fileName: string, content: string) =>
    post<KnowledgeDocument>("/api/knowledge-documents/import", {
      workspaceId,
      fileName,
      content,
    }),
};
