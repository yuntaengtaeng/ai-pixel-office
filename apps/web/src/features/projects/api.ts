import type { Project } from "@ai-pixel-office/domain/entities";
import { post, request } from "../../shared/api/client.ts";

export const projectApi = {
  list: (workspaceId: string) =>
    request<Project[]>(`/api/projects?workspaceId=${encodeURIComponent(workspaceId)}`),
  get: (id: string) => request<Project>(`/api/projects/${id}`),
  create: (input: {
    workspaceId: string;
    name: string;
    description?: string;
    figmaUrl?: string;
    path?: string;
  }) => post<Project>("/api/projects", input),
  update: (
    id: string,
    input: Partial<Pick<Project, "name" | "description" | "status" | "figmaUrl" | "path">>,
  ) => request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
};
