import type { AgentModel, Project } from "@ai-pixel-office/domain/entities";
import { post, request } from "../../shared/api/client.ts";

/** 프로젝트 폴더를 읽어 만든 설정 제안 */
export type ProjectSetupSuggestions = {
  /** Git 저장소라 기안서마다 작업 공간으로 격리할 수 있는지 */
  isolated: boolean;
  setupCommand?: string;
  verificationCommands: string[];
  copyFiles: string[];
};

export type ProjectSettingsInput = Partial<
  Pick<
    Project,
    | "name"
    | "description"
    | "status"
    | "figmaUrl"
    | "path"
    | "memo"
    | "verificationCommands"
    | "setupCommand"
    | "copyFiles"
    | "previewUrl"
  >
> & {
  /** null이면 기본 담당을 지움 */
  defaultAgentId?: string | null;
  /** null이면 workspace 기본 동료의 runtime을 씀 */
  leadRuntime?: AgentModel | null;
};

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
  update: (id: string, input: ProjectSettingsInput) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  setupSuggestions: (id: string) =>
    request<ProjectSetupSuggestions>(`/api/projects/${id}/setup-suggestions`),
  remove: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
};
