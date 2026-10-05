import type { ActivityLog, AgentRun } from "@ai-pixel-office/domain/entities";

/** 지금 run이 기다리는 권한 요청 (아직 답하지 않은 마지막 요청) */
export function pendingApprovalOf(
  latestRun: AgentRun | undefined,
  activities: ActivityLog[],
): ActivityLog | undefined {
  if (latestRun?.status !== "waiting") return undefined;
  const runActivities = activities.filter((activity) => activity.runId === latestRun.id);
  const requestIdOf = (activity: ActivityLog) => String(activity.metadata?.requestId ?? "");
  return runActivities.find(
    (activity) =>
      activity.type === "approval_requested" &&
      !runActivities.some(
        (candidate) =>
          candidate.type === "approval_resolved" &&
          requestIdOf(candidate) === requestIdOf(activity) &&
          candidate.createdAt > activity.createdAt,
      ),
  );
}

export const ACTIVE_RUN_STATUSES: ReadonlyArray<AgentRun["status"]> = [
  "queued",
  "running",
  "waiting",
];

export function isRunActive(run: AgentRun | undefined): boolean {
  return Boolean(run && ACTIVE_RUN_STATUSES.includes(run.status));
}
