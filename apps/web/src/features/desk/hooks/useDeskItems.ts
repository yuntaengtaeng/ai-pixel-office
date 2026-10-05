import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../../activity/api.ts";
import { taskApi } from "../../tasks/api.ts";
import { buildDeskItems, type DeskItem } from "../utils/deskItems.ts";

/** workspace의 결재함 서류 목록 조회 */
export function useDeskItems(workspaceId: string): {
  items: DeskItem[];
  isPending: boolean;
  isError: boolean;
} {
  const tasks = useQuery({
    queryKey: ["tasks", workspaceId],
    queryFn: () => taskApi.list(workspaceId),
  });
  const activities = useQuery({
    queryKey: ["activities", workspaceId],
    queryFn: () => activityApi.list(workspaceId),
  });
  return {
    items: buildDeskItems(tasks.data ?? [], activities.data ?? []),
    isPending: tasks.isPending || activities.isPending,
    isError: tasks.isError || activities.isError,
  };
}
