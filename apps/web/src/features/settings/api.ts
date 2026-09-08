import { request } from "../../shared/api/client.ts";

export type StorageSummary = {
  totalBytes: number;
  attachmentBytes: number;
  runtimeLogBytes: number;
  databaseBytes: number;
  completedTaskBytes: number;
  completedTaskCount: number;
  pendingAttachmentBytes: number;
  pendingAttachmentCount: number;
};

const path = (workspaceId: string) => `?workspaceId=${encodeURIComponent(workspaceId)}`;

export const storageApi = {
  summary: (workspaceId: string) => request<StorageSummary>(`/api/storage${path(workspaceId)}`),
  cleanPending: (workspaceId: string) =>
    request<{ deletedCount: number }>(`/api/storage/pending${path(workspaceId)}`, { method: "DELETE" }),
  cleanCompleted: (workspaceId: string) =>
    request<{ deletedCount: number }>(`/api/storage/completed-tasks${path(workspaceId)}`, { method: "DELETE" }),
  reset: () =>
    request<{ reset: boolean }>("/api/storage/reset", {
      method: "POST",
      body: JSON.stringify({ confirmation: "AI Pixel Office 데이터 초기화" }),
    }),
};
