import { post, request } from "../../shared/api/client.ts";

export type McpServerStatus = {
  configured: boolean;
  enabled: boolean;
  authenticated?: boolean;
  detail: string;
};

export type McpIntegrationStatus = {
  codex: McpServerStatus;
  claude: McpServerStatus;
};

export type SystemStatus = {
  serverWorkingDirectory: string;
  codex: { installed: boolean; version?: string; authenticated: boolean; detail: string };
  claude: { installed: boolean; version?: string; authenticated: boolean; detail: string };
  mcp: Record<"figma", McpIntegrationStatus>;
};

export const systemApi = {
  status: () => request<SystemStatus>("/api/system/status"),
  checkDirectory: (path: string) =>
    post<{ path: string; valid: boolean }>("/api/system/check-directory", { path }),
  pickDirectory: (startPath?: string) =>
    post<{ path?: string; cancelled: boolean }>("/api/system/pick-directory", { startPath }),
};
