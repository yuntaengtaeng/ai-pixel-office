import type { PerformanceAwardKind, PerformanceReviewPeriod } from "@ai-pixel-office/domain/entities";

export const PERIOD_LABEL: Record<PerformanceReviewPeriod, string> = {
  week: "이번 주",
  month: "이번 달",
  all: "전체",
};

export const AWARD_LABEL: Record<PerformanceAwardKind, string> = {
  top_agent: "이달의 에이전트",
  versatile: "만능 재주꾼상",
};

export const AWARD_SEAL: Record<PerformanceAwardKind, string> = {
  top_agent: "★",
  versatile: "◆",
};
