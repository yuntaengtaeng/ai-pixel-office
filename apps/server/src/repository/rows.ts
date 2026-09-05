import type {
  Agent,
  AgentRun,
  AgentRunStatus,
  AgentTaskTemplate,
  Input,
  InputStatus,
  Project,
  RunUsage,
  Skill,
  Task,
  TaskResult,
  TaskStatus,
  TaskWorkflowStep,
  WorkflowPreset,
  WorkflowStepStatus,
  Workspace,
} from "@ai-pixel-office/domain";
import type { AppDatabase } from "../database.ts";

export type Row = Record<string, unknown>;

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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function skillFrom(row: Row): Skill {
  return {
    id: String(row.id),
    workspaceId: optional(row.workspace_id),
    name: String(row.name),
    category: String(row.category),
    description: String(row.description),
    instructions: String(row.instructions),
    tools: json(row.tools_json, []),
    requiredPermissions: json(row.required_permissions_json, []),
    outputSchema: json<Record<string, unknown> | undefined>(row.output_schema_json, undefined),
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
    sourceInputId: optional(row.source_input_id),
    dueDate: optional(row.due_date),
    priority: row.priority as Task["priority"],
    projectId: optional(row.project_id),
    workingDirectory: optional(row.working_directory),
    result: json<TaskResult | undefined>(row.result_json, undefined),
    origin: (row.origin === "chat" ? "chat" : "office") as Task["origin"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: optional(row.completed_at),
  };
}

export function inputFrom(row: Row): Input {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    type: row.type as Input["type"],
    title: optional(row.title),
    content: String(row.content),
    status: row.status as InputStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function workflowStepFrom(row: Row): TaskWorkflowStep {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    agentId: String(row.agent_id),
    position: Number(row.position),
    status: row.status as WorkflowStepStatus,
    runId: optional(row.run_id),
    result: json<TaskResult | undefined>(row.result_json, undefined),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function workflowPresetFrom(row: Row): WorkflowPreset {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    agentIds: json<string[]>(row.agent_ids_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
