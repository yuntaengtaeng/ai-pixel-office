import type { PerformanceReviewPeriod, PerformanceReviewSummary } from "@ai-pixel-office/domain/entities";
import { request } from "../../shared/api/client.ts";

export const performanceApi = {
  summary: (workspaceId: string, period: PerformanceReviewPeriod) =>
    request<PerformanceReviewSummary>(
      `/api/performance/summary?workspaceId=${encodeURIComponent(workspaceId)}&period=${period}`,
    ),
};
