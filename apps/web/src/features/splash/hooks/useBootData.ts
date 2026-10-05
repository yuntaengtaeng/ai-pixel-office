import { useQuery } from "@tanstack/react-query";
import type { Agent, Workspace } from "@ai-pixel-office/domain/entities";
import { agentApi } from "../../agents/api.ts";
import { systemApi, type SystemStatus } from "../../system/api.ts";
import { workspaceApi } from "../../workspaces/api.ts";
import { messageOf } from "../../../shared/lib/errors.ts";

export type BootData =
  | { status: "loading"; message: string }
  | { status: "error"; error: string; retry: () => void }
  | {
      status: "ready";
      workspace: Workspace;
      runtimeStatus: SystemStatus;
      agents: Agent[];
      refreshRuntimeStatus: () => Promise<unknown>;
    };

/** 앱을 열기 전에 필요한 workspace, 런타임 연결 상태, 동료 목록을 차례로 불러옴 */
export function useBootData(): BootData {
  const workspace = useQuery({
    queryKey: ["workspace"],
    queryFn: async () => {
      const workspaces = await workspaceApi.list();
      return workspaces[0] ?? workspaceApi.create("나의 AI 오피스");
    },
    staleTime: Infinity,
  });
  const workspaceId = workspace.data?.id;
  const runtimeStatus = useQuery({
    queryKey: ["system-status"],
    queryFn: systemApi.status,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: Boolean(workspaceId),
  });
  const agents = useQuery({
    queryKey: ["agents", workspaceId],
    queryFn: () => agentApi.list(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  if (workspace.isPending) return { status: "loading", message: "오피스를 여는 중이에요." };
  if (workspace.isError || !workspace.data)
    return {
      status: "error",
      error: messageOf(workspace.error),
      retry: () => void workspace.refetch(),
    };
  if (runtimeStatus.isPending || agents.isPending)
    return { status: "loading", message: "AI 연결과 출근 가능한 동료를 확인하는 중이에요." };
  if (runtimeStatus.isError || agents.isError || !runtimeStatus.data)
    return {
      status: "error",
      error: messageOf(runtimeStatus.error ?? agents.error),
      retry: () => {
        void runtimeStatus.refetch();
        void agents.refetch();
      },
    };
  return {
    status: "ready",
    workspace: workspace.data,
    runtimeStatus: runtimeStatus.data,
    agents: agents.data ?? [],
    refreshRuntimeStatus: runtimeStatus.refetch,
  };
}
