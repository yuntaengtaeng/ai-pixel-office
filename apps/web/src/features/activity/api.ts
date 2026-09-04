import type { ActivityLog } from "../../../../../packages/domain/src/entities.ts";
import { request } from "../../shared/api/client.ts";

export const activityApi = {
  list: (workspaceId: string) =>
    request<ActivityLog[]>(
      `/api/activities?workspaceId=${encodeURIComponent(workspaceId)}&limit=20`,
    ),
};
