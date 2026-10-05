import { randomUUID } from "node:crypto";
import {
  DomainError,
  type AgentModel,
  type LeadMessage,
  type LeadPlan,
  type LeadPlanItem,
  type Task,
} from "@ai-pixel-office/domain";
import { requireEntity, type AppDatabase } from "../database.ts";
import { json, now, type Row } from "./rows.ts";
import { withTransaction } from "./shared.ts";
import { getProjectSync } from "./projects.ts";
import { createActivitySync } from "./activities.ts";
import { insertTask } from "./tasks.ts";

function leadMessageFrom(row: Row): LeadMessage {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    role: row.role as LeadMessage["role"],
    content: String(row.content),
    ...(row.plan_id ? { planId: String(row.plan_id) } : {}),
    status: row.status as LeadMessage["status"],
    createdAt: String(row.created_at),
  };
}

function leadPlanFrom(row: Row): LeadPlan {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    status: row.status as LeadPlan["status"],
    title: String(row.title),
    reason: String(row.reason),
    items: json<LeadPlanItem[]>(row.items_json, []),
    ...(row.feedback ? { feedback: String(row.feedback) } : {}),
    createdAt: String(row.created_at),
    ...(row.decided_at ? { decidedAt: String(row.decided_at) } : {}),
  };
}

export function listLeadMessages(database: AppDatabase, projectId: string): LeadMessage[] {
  return database
    .prepare("SELECT * FROM lead_messages WHERE project_id = ? ORDER BY created_at, rowid")
    .all(projectId)
    .map((row) => leadMessageFrom(row as Row));
}

export function createLeadMessage(
  database: AppDatabase,
  input: Pick<LeadMessage, "projectId" | "role" | "content" | "status"> & { runtime?: AgentModel },
): LeadMessage {
  const message: LeadMessage = {
    id: randomUUID(),
    projectId: input.projectId,
    role: input.role,
    content: input.content,
    status: input.status,
    createdAt: now(),
  };
  database
    .prepare(
      "INSERT INTO lead_messages (id, project_id, role, content, status, runtime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      message.id,
      message.projectId,
      message.role,
      message.content,
      message.status,
      input.runtime ?? null,
      message.createdAt,
    );
  return message;
}

/** 팀장 답을 끝냄 (실행 결과, 계획서, 이어갈 runtime 세션) */
export function finishLeadMessage(
  database: AppDatabase,
  id: string,
  input: { status: "done" | "failed"; content: string; planId?: string; threadId?: string },
): LeadMessage {
  database
    .prepare(
      "UPDATE lead_messages SET status = ?, content = ?, plan_id = ?, thread_id = ? WHERE id = ?",
    )
    .run(input.status, input.content, input.planId ?? null, input.threadId ?? null, id);
  const row = database.prepare("SELECT * FROM lead_messages WHERE id = ?").get(id);
  return leadMessageFrom(requireEntity(row as Row | undefined, "LeadMessage", id));
}

/** 같은 runtime으로 이어갈 팀장의 마지막 세션 */
export function latestLeadThread(
  database: AppDatabase,
  projectId: string,
  runtime: AgentModel,
): string | undefined {
  const row = database
    .prepare(
      `SELECT thread_id FROM lead_messages
       WHERE project_id = ? AND role = 'lead' AND status = 'done' AND runtime = ? AND thread_id IS NOT NULL
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get(projectId, runtime) as { thread_id: string } | undefined;
  return row?.thread_id;
}

export function hasPendingLeadMessage(database: AppDatabase, projectId: string): boolean {
  return Boolean(
    database
      .prepare("SELECT 1 FROM lead_messages WHERE project_id = ? AND status = 'pending' LIMIT 1")
      .get(projectId),
  );
}

/** 서버가 다시 시작돼 끝나지 못한 팀장 답을 실패로 */
export function failPendingLeadMessages(database: AppDatabase): number {
  return Number(
    database
      .prepare(
        "UPDATE lead_messages SET status = 'failed', content = '서버가 다시 시작돼 답을 끝내지 못했어요. 다시 말해 주세요.' WHERE status = 'pending'",
      )
      .run().changes,
  );
}

export function createLeadPlan(
  database: AppDatabase,
  input: Pick<LeadPlan, "projectId" | "title" | "reason" | "items">,
): LeadPlan {
  const plan: LeadPlan = { id: randomUUID(), ...input, status: "proposed", createdAt: now() };
  database
    .prepare(
      "INSERT INTO lead_plans (id, project_id, status, title, reason, items_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      plan.id,
      plan.projectId,
      plan.status,
      plan.title,
      plan.reason,
      JSON.stringify(plan.items),
      plan.createdAt,
    );
  return plan;
}

export function getLeadPlan(database: AppDatabase, id: string): LeadPlan | undefined {
  const row = database.prepare("SELECT * FROM lead_plans WHERE id = ?").get(id);
  return row ? leadPlanFrom(row as Row) : undefined;
}

export function listLeadPlans(database: AppDatabase, projectId: string): LeadPlan[] {
  return database
    .prepare("SELECT * FROM lead_plans WHERE project_id = ? ORDER BY created_at")
    .all(projectId)
    .map((row) => leadPlanFrom(row as Row));
}

function requireProposedPlan(database: AppDatabase, id: string): LeadPlan {
  const plan = requireEntity(getLeadPlan(database, id), "LeadPlan", id);
  if (plan.status !== "proposed") {
    throw new DomainError("PLAN_ALREADY_DECIDED", "이미 결재했거나 반려한 계획서예요", 409);
  }
  return plan;
}

/** 계획서 반려 (의견이 비어 있으면 진행하지 않기로 한 것) */
export function rejectLeadPlan(database: AppDatabase, id: string, feedback: string): LeadPlan {
  return withTransaction(database, () => {
    requireProposedPlan(database, id);
    database
      .prepare(
        "UPDATE lead_plans SET status = 'rejected', feedback = ?, decided_at = ? WHERE id = ?",
      )
      .run(feedback || null, now(), id);
    return requireEntity(getLeadPlan(database, id), "LeadPlan", id);
  });
}

/** 계획서 결재: 기안마다 기안서를 만들고 앞 기안을 기안서 id로 이어 둠 (앞 기안이 있으면 순서 대기) */
export function approveLeadPlan(
  database: AppDatabase,
  id: string,
): { plan: LeadPlan; tasks: Task[] } {
  return withTransaction(database, () => {
    const proposed = requireProposedPlan(database, id);
    const project = requireEntity(
      getProjectSync(database, proposed.projectId),
      "Project",
      proposed.projectId,
    );
    const taskIdByKey = new Map<string, string>();
    const titleByKey = new Map(proposed.items.map((item) => [item.key, item.title]));
    const tasks: Task[] = [];
    for (const item of proposed.items) {
      const task = insertTask(database, {
        workspaceId: project.workspaceId,
        title: item.title,
        description: `${item.brief}\n\n끝나면 받을 것: ${item.deliverable}`,
        assigneeAgentId: item.agentId,
        projectId: project.id,
        ...(item.resultFormat ? { resultFormat: item.resultFormat } : {}),
        modifiesFiles: item.modifiesFiles,
        planId: proposed.id,
        waitsFor: item.after.map((key) => taskIdByKey.get(key) ?? "").filter(Boolean),
        reviewBeforeNext: item.reviewBeforeNext,
        ...(item.after[0] ? { queuedBehind: titleByKey.get(item.after[0]) } : {}),
      });
      taskIdByKey.set(item.key, task.id);
      createActivitySync(database, {
        workspaceId: task.workspaceId,
        type: "task_created",
        taskId: task.id,
        message: `Task created from plan: ${task.title}`,
      });
      tasks.push(task);
    }
    database
      .prepare("UPDATE lead_plans SET status = 'approved', decided_at = ? WHERE id = ?")
      .run(now(), id);
    return { plan: requireEntity(getLeadPlan(database, id), "LeadPlan", id), tasks };
  });
}
