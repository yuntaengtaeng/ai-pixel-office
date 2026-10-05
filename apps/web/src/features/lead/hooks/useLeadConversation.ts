import { useQuery, useQueryClient } from "@tanstack/react-query";
import { leadApi } from "../api.ts";

const REPLYING_REFRESH_MS = 1500;

/** 프로젝트 팀장 대화 조회 (팀장이 답을 쓰는 동안 주기적으로 다시 읽음) */
export function useLeadConversation(projectId: string) {
  return useQuery({
    queryKey: ["lead", projectId],
    queryFn: () => leadApi.conversation(projectId),
    refetchInterval: (query) => (query.state.data?.replying ? REPLYING_REFRESH_MS : false),
  });
}

/** 팀장 대화와 이 프로젝트 기안서 목록을 다시 읽음 */
export function useLeadRefresh(projectId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["lead", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
  };
}
