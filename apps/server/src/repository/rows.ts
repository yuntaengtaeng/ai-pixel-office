import type {
  Agent,
  AgentModel,
  AgentRun,
  AgentRunStatus,
  AgentTaskTemplate,
  Project,
  RunUsage,
  Task,
  TaskResult,
  TaskStatus,
  Workspace,
} from "@ai-pixel-office/domain";
import { isResultFormat } from "@ai-pixel-office/domain";
import type { AppDatabase } from "../database.ts";

export type Row = Record<string, unknown>;

/** 저장된 runtime 이름 (알 수 없는 값이면 없음) */
export function agentModelOf(value: unknown): AgentModel | undefined {
  return value === "claude" || value === "codex" ? value : undefined;
}

export function now(): string {
  return new Date().toISOString();
}

export function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function optional(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function workspaceFrom(row: Row): Workspace {
  return {
    id: String(row.id),
    name: String(row.name),
    workingDirectory: optional(row.working_directory),
    defaultAgentId: optional(row.default_agent_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function projectFrom(row: Row): Project {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    description: optional(row.description),
    status: row.status as Project["status"],
    figmaUrl: optional(row.figma_url),
    path: optional(row.working_directory),
    memo: optional(row.memo),
    verificationCommands: json<string[]>(row.verification_commands_json, []),
    setupCommand: optional(row.setup_command),
    copyFiles: json<string[]>(row.copy_files_json, []),
    defaultAgentId: optional(row.default_agent_id),
    previewUrl: optional(row.preview_url),
    leadRuntime: agentModelOf(row.lead_runtime),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function taskFrom(row: Row): Task {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    description: optional(row.description),
    status: row.status as TaskStatus,
    assigneeAgentId: optional(row.assignee_agent_id),
    dueDate: optional(row.due_date),
    priority: row.priority as Task["priority"],
    projectId: optional(row.project_id),
    workingDirectory: optional(row.working_directory),
    result: json<TaskResult | undefined>(row.result_json, undefined),
    origin: (row.origin === "chat" ? "chat" : "office") as Task["origin"],
    resultFormat: isResultFormat(row.result_format) ? row.result_format : undefined,
    ...(row.modifies_files === 0 ? { modifiesFiles: false } : {}),
    planId: optional(row.plan_id),
    ...(row.waits_for_json ? { waitsFor: json<string[]>(row.waits_for_json, []) } : {}),
    ...(Number(row.review_before_next ?? 0) === 1 ? { reviewBeforeNext: true } : {}),
    queuedBehind: optional(row.queued_behind),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: optional(row.completed_at),
  };
}

export function taskTemplateFrom(row: Row): AgentTaskTemplate {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    title: String(row.title),
    description: optional(row.description),
    priority: row.priority as AgentTaskTemplate["priority"],
    createdAt: String(row.created_at),
  };
}

export function runFrom(row: Row): AgentRun {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    agentId: String(row.agent_id),
    runtime: row.runtime as AgentRun["runtime"],
    modelPolicy: (optional(row.model_policy) ?? "default") as AgentRun["modelPolicy"],
    modelName: optional(row.model_name),
    reasoningEffort: optional(row.reasoning_effort) as AgentRun["reasoningEffort"],
    status: row.status as AgentRunStatus,
    resumedFromRunId: optional(row.resumed_from_run_id),
    runtimeThreadId: optional(row.runtime_thread_id),
    startedAt: optional(row.started_at),
    finishedAt: optional(row.finished_at),
    eventLogRef: optional(row.event_log_ref),
    usage: json<RunUsage | undefined>(row.usage_json, undefined),
    request: optional(row.request_text),
    result: json<TaskResult | undefined>(row.result_json, undefined),
    scopeType: (optional(row.scope_type) ?? "general") as AgentRun["scopeType"],
    scopeProjectId: optional(row.scope_project_id),
    workingDirectory: optional(row.working_directory),
    error: optional(row.error),
    cleanupPolicy: row.cleanup_policy as AgentRun["cleanupPolicy"],
    createdAt: String(row.created_at),
  };
}

export function agentFrom(database: AppDatabase, row: Row): Agent {
  const skillRows = database
    .prepare("SELECT skill_id FROM agent_skills WHERE agent_id = ? ORDER BY skill_id")
    .all(String(row.id));
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    role: String(row.role),
    description: optional(row.description),
    model: row.model as Agent["model"],
    modelPolicy: (optional(row.model_policy) ?? "default") as Agent["modelPolicy"],
    modelName: optional(row.model_name),
    reasoningEffort: optional(row.reasoning_effort) as Agent["reasoningEffort"],
    mode: (row.mode === "chat" ? "chat" : "worker") as Agent["mode"],
    avatarId: optional(row.avatar_id),
    skillIds: skillRows.map((skill) => String((skill as Row).skill_id)),
    permissions: json(row.permissions_json, {}),
    systemPrompt: optional(row.system_prompt),
    workingDirectory: optional(row.working_directory),
    sourceTeam: optional(row.source_team),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
