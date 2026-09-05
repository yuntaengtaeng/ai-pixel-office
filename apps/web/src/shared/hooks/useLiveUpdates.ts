import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaceEvent } from "./useWorkspaceEvent.ts";

const LIVE_UPDATE_EVENTS = [
  "task.status_changed",
  "task.result_updated",
  "agent.status_changed",
  "activity.created",
  "approval.requested",
  "run.progress",
];

/** SSE로 워크스페이스 실시간 이벤트를 받으면 관련 쿼리를 무효화, 화면별 갱신 로직은 두지 않음 */
export function useLiveUpdates(workspaceId: string) {
  const queryClient = useQueryClient();
  useWorkspaceEvent(workspaceId, LIVE_UPDATE_EVENTS, () => {
    void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["activities", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["task"] });
    void queryClient.invalidateQueries({ queryKey: ["pet-unlocks", workspaceId] });
  });
}
