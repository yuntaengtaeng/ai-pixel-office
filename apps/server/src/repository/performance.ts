import type {
  AgentPerformanceMetric,
  AgentRunStatus,
  PerformanceAward,
  PerformanceReviewPeriod,
  PerformanceReviewSummary,
  RunUsage,
  SkillPerformanceMetric,
} from "@ai-pixel-office/domain";
import type { AppDatabase } from "../database.ts";
import { json } from "./rows.ts";

const RUN_STATUSES: AgentRunStatus[] = [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
];

function periodStartFor(period: PerformanceReviewPeriod): string | undefined {
  if (period === "all") return undefined;
  const days = period === "week" ? 7 : 30;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  return start.toISOString();
}

type RunRow = {
  run_id: string;
  task_id: string;
  agent_id: string;
  agent_name: string;
  status: AgentRunStatus;
  started_at: string | null;
  finished_at: string | null;
  usage_json: string | null;
};

function loadRuns(database: AppDatabase, workspaceId: string, periodStart?: string): RunRow[] {
  const clauses = ["tasks.workspace_id = ?"];
  const params: string[] = [workspaceId];
  if (periodStart) {
    clauses.push("agent_runs.created_at >= ?");
    params.push(periodStart);
  }
  return database
    .prepare(
      `SELECT agent_runs.id AS run_id, agent_runs.task_id AS task_id, agent_runs.agent_id AS agent_id,
              agents.name AS agent_name, agent_runs.status AS status, agent_runs.started_at AS started_at,
              agent_runs.finished_at AS finished_at, agent_runs.usage_json AS usage_json
       FROM agent_runs
       JOIN tasks ON tasks.id = agent_runs.task_id
       JOIN agents ON agents.id = agent_runs.agent_id
       WHERE ${clauses.join(" AND ")}`,
    )
    .all(...params) as RunRow[];
}

function averageUsage(usages: RunUsage[]): RunUsage | undefined {
  if (usages.length === 0) return undefined;
  const sum = (key: keyof RunUsage) =>
    usages.reduce((total, usage) => total + (usage[key] ?? 0), 0);
  return {
    inputTokens: sum("inputTokens") / usages.length,
    outputTokens: sum("outputTokens") / usages.length,
    cachedInputTokens: sum("cachedInputTokens") / usages.length,
    estimatedCost: sum("estimatedCost") / usages.length,
  };
}

function topSkillIdsFor(database: AppDatabase, runIds: string[], limit = 3): string[] {
  if (runIds.length === 0) return [];
  const placeholders = runIds.map(() => "?").join(", ");
  const rows = database
    .prepare(
      `SELECT skill_id, COUNT(*) AS usage_count
       FROM run_skills
       WHERE run_id IN (${placeholders})
       GROUP BY skill_id
       ORDER BY usage_count DESC, skill_id
       LIMIT ?`,
    )
    .all(...runIds, limit) as Array<{ skill_id: string }>;
  return rows.map((row) => row.skill_id);
}

/** Task 담당 완료 여부는 run row가 아니라 task_id distinct 기준, 재시도/계속하기가 별도 run으로 쌓여도 중복 집계하지 않음 */
function buildAgentMetric(
  database: AppDatabase,
  agentId: string,
  agentName: string,
  runs: RunRow[],
): AgentPerformanceMetric {
  const assignedTaskIds = new Set(runs.map((run) => run.task_id));
  const completedTaskIds = new Set(
    runs.filter((run) => run.status === "completed").map((run) => run.task_id),
  );
  const statusCounts = Object.fromEntries(
    RUN_STATUSES.map((status) => [status, runs.filter((run) => run.status === status).length]),
  ) as Record<AgentRunStatus, number>;

  const durations = runs
    .filter((run) => run.started_at && run.finished_at)
    .map((run) => new Date(run.finished_at as string).getTime() - new Date(run.started_at as string).getTime())
    .filter((durationMs) => Number.isFinite(durationMs) && durationMs >= 0);
  const averageDurationMs =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined;

  const usages = runs
    .map((run) => json<RunUsage | undefined>(run.usage_json, undefined))
    .filter((usage): usage is RunUsage => usage !== undefined);

  return {
    agentId,
    agentName,
    assignedTaskCount: assignedTaskIds.size,
    completedTaskCount: completedTaskIds.size,
    completionRate: assignedTaskIds.size > 0 ? completedTaskIds.size / assignedTaskIds.size : 0,
    statusCounts,
    averageDurationMs,
    averageUsage: averageUsage(usages),
    topSkillIds: topSkillIdsFor(database, runs.map((run) => run.run_id)),
  };
}

function buildSkillMetrics(database: AppDatabase, runs: RunRow[]): SkillPerformanceMetric[] {
  if (runs.length === 0) return [];
  const runIds = runs.map((run) => run.run_id);
  const placeholders = runIds.map(() => "?").join(", ");
  const rows = database
    .prepare(
      `SELECT run_skills.skill_id AS skill_id, run_skills.skill_name_snapshot AS skill_name,
              run_skills.run_id AS run_id
       FROM run_skills
       WHERE run_skills.run_id IN (${placeholders})`,
    )
    .all(...runIds) as Array<{ skill_id: string; skill_name: string; run_id: string }>;

  const runAgent = new Map(runs.map((run) => [run.run_id, run.agent_id]));
  const bySkill = new Map<string, { name: string; count: number; agentCounts: Map<string, number> }>();
  for (const row of rows) {
    const entry = bySkill.get(row.skill_id) ?? {
      name: row.skill_name,
      count: 0,
      agentCounts: new Map<string, number>(),
    };
    entry.count += 1;
    const agentId = runAgent.get(row.run_id);
    if (agentId) entry.agentCounts.set(agentId, (entry.agentCounts.get(agentId) ?? 0) + 1);
    bySkill.set(row.skill_id, entry);
  }

  return [...bySkill.entries()]
    .map(([skillId, entry]) => ({
      skillId,
      skillName: entry.name,
      usageCount: entry.count,
      topAgentIds: [...entry.agentCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([agentId]) => agentId),
    }))
    .sort((a, b) => b.usageCount - a.usageCount);
}

/** 사실 기반 상만 부여, 최소 표본(완료 2건) 미만인 Agent는 후보에서 제외 */
function buildAwards(metrics: AgentPerformanceMetric[]): PerformanceAward[] {
  const MIN_SAMPLE = 2;
  const eligible = metrics.filter((metric) => metric.completedTaskCount >= MIN_SAMPLE);
  if (eligible.length === 0) return [];

  const awards: PerformanceAward[] = [];
  const topAgent = [...eligible].sort((a, b) => b.completedTaskCount - a.completedTaskCount)[0];
  awards.push({
    kind: "top_agent",
    agentId: topAgent.agentId,
    agentName: topAgent.agentName,
    reason: `완료 작업 ${topAgent.completedTaskCount}건`,
    evidenceTaskIds: [],
  });

  const versatile = [...eligible].sort((a, b) => b.topSkillIds.length - a.topSkillIds.length)[0];
  if (versatile.topSkillIds.length > 1) {
    awards.push({
      kind: "versatile",
      agentId: versatile.agentId,
      agentName: versatile.agentName,
      reason: `Skill ${versatile.topSkillIds.length}종 활용`,
      evidenceTaskIds: [],
    });
  }

  return awards.slice(0, 5);
}

export async function getPerformanceSummary(
  database: AppDatabase,
  workspaceId: string,
  period: PerformanceReviewPeriod,
): Promise<PerformanceReviewSummary> {
  const periodStart = periodStartFor(period);
  const runs = loadRuns(database, workspaceId, periodStart);

  const agentNames = new Map(runs.map((run) => [run.agent_id, run.agent_name]));
  const agentMetrics = [...agentNames.entries()]
    .map(([agentId, agentName]) =>
      buildAgentMetric(database, agentId, agentName, runs.filter((run) => run.agent_id === agentId)),
    )
    .sort((a, b) => b.completedTaskCount - a.completedTaskCount);

  const assignedTaskIds = new Set(runs.map((run) => run.task_id));
  const completedTaskIds = new Set(
    runs.filter((run) => run.status === "completed").map((run) => run.task_id),
  );

  const runIds = runs.map((run) => run.run_id);
  const snapshotCount =
    runIds.length === 0
      ? 0
      : (
          database
            .prepare(
              `SELECT COUNT(DISTINCT run_id) AS count FROM run_skills WHERE run_id IN (${runIds
                .map(() => "?")
                .join(", ")})`,
            )
            .get(...runIds) as { count: number }
        ).count;

  return {
    workspaceId,
    period,
    periodStart,
    periodEnd: periodStart ? new Date().toISOString() : undefined,
    teamTotals: {
      assignedTaskCount: assignedTaskIds.size,
      completedTaskCount: completedTaskIds.size,
      completionRate: assignedTaskIds.size > 0 ? completedTaskIds.size / assignedTaskIds.size : 0,
    },
    agentMetrics,
    skillMetrics: buildSkillMetrics(database, runs),
    awards: buildAwards(agentMetrics),
    unattributedRunSkillCount: runIds.length - snapshotCount,
  };
}
