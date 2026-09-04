import { post, request } from "../../shared/api/client.ts";

export type SystemStatus = {
  serverWorkingDirectory: string;
  codex: { installed: boolean; version?: string; authenticated: boolean; detail: string };
  claude: { installed: boolean; version?: string; authenticated: boolean; detail: string };
  figma: {
    configured: boolean;
    enabled: boolean;
    authenticated?: boolean;
    detail: string;
    claudeConfigured: boolean;
    claudeAuthenticated?: boolean;
    claudeDetail: string;
  };
};

export const systemApi = {
  status: () => request<SystemStatus>("/api/system/status"),
  checkDirectory: (path: string) =>
    post<{ path: string; valid: boolean }>("/api/system/check-directory", { path }),
  pickDirectory: (startPath?: string) =>
    post<{ path?: string; cancelled: boolean }>("/api/system/pick-directory", { startPath }),
};
