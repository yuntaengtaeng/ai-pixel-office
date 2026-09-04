import type { Workspace } from "@ai-pixel-office/domain/entities";
import { post, request } from "../../shared/api/client.ts";

export const workspaceApi = {
  list: () => request<Workspace[]>("/api/workspaces"),
  create: (name: string) => post<Workspace>("/api/workspaces", { name }),
  update: (id: string, input: { name?: string; workingDirectory?: string }) =>
    request<Workspace>(`/api/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};
