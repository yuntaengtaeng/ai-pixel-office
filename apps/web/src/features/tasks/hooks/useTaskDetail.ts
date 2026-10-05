import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { activityApi } from "../../activity/api.ts";
import { agentApi } from "../../agents/api.ts";
import { taskApi } from "../api.ts";
import { pendingApprovalOf } from "../utils/pendingApproval.ts";

/** 기안서 화면이 함께 쓰는 조회 (기안서, 동료, 활동)와 그로부터 계산한 지금 run, 대기 중인 권한 요청 */
export function useTaskDetail(taskId: string, workspace: Workspace) {
  const task = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => taskApi.get(taskId),
    refetchInterval: (query) =>
      ["working", "needs_input"].includes(query.state.data?.status ?? "") ? 1500 : false,
  });
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const activities = useQuery({
    queryKey: ["activities", workspace.id],
    queryFn: () => activityApi.list(workspace.id),
  });
  const latestRun = task.data?.runs[0];
  return {
    task,
    agents: agents.data ?? [],
    activities: activities.data ?? [],
    latestRun,
    pendingApproval: pendingApprovalOf(latestRun, activities.data ?? []),
  };
}

/** 기안서와 관련 목록을 다시 불러옴 */
export function useTaskRefresh(taskId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["task-workspace", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["task-execution-context", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["activities", workspaceId] });
  };
}
