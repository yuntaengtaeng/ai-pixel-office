import { DomainError } from "./errors.ts";
import type {
  AgentModel,
  AgentPermissions,
  CreateAgentInput,
  CreateSkillInput,
  CreateTaskInput,
  CreateWorkspaceInput,
  ResultFormat,
  UpdateAgentInput,
  UpdateTaskInput,
  UpdateWorkspaceInput,
} from "./entities.ts";
import { isResultFormat, RESULT_FORMATS } from "./entities.ts";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError("INVALID_BODY", "Request body must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string, required = true): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError("INVALID_FIELD", `${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return string(value, field);
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new DomainError("INVALID_FIELD", `${field} must be an array of strings`);
  }
  return [...new Set(value as string[])];
}

function model(value: unknown): AgentModel {
  if (value !== "claude" && value !== "codex") {
    throw new DomainError("INVALID_FIELD", "model must be claude or codex");
  }
  return value;
}

function agentMode(value: unknown): "worker" | "chat" {
  if (value !== "worker" && value !== "chat") {
    throw new DomainError("INVALID_FIELD", "mode must be worker or chat");
  }
  return value;
}

function modelPolicy(value: unknown): "default" | "auto" | "manual" {
  if (value !== "default" && value !== "auto" && value !== "manual") {
    throw new DomainError("INVALID_FIELD", "modelPolicy must be default, auto, or manual");
  }
  return value;
}

function reasoningEffort(value: unknown): "low" | "medium" | "high" | "xhigh" {
  if (value !== "low" && value !== "medium" && value !== "high" && value !== "xhigh") {
    throw new DomainError("INVALID_FIELD", "reasoningEffort must be low, medium, high, or xhigh");
  }
  return value;
}

function permissions(value: unknown): AgentPermissions {
  const source = object(value);
  const result: AgentPermissions = {};
  for (const key of ["fileRead", "fileWrite", "terminal", "git", "browser", "figma"] as const) {
    const setting = source[key];
    if (setting !== undefined && typeof setting !== "boolean") {
      throw new DomainError("INVALID_FIELD", `permissions.${key} must be boolean`);
    }
    if (typeof setting === "boolean") result[key] = setting;
  }
  return result;
}

export function parseCreateWorkspace(value: unknown): CreateWorkspaceInput {
  const body = object(value);
  return {
    name: string(body.name, "name") as string,
  };
}

export function parseUpdateWorkspace(value: unknown): UpdateWorkspaceInput {
  const body = object(value);
  return {
    ...(body.name !== undefined ? { name: string(body.name, "name") } : {}),
    ...(body.defaultAgentId !== undefined
      ? { defaultAgentId: optionalString(body.defaultAgentId, "defaultAgentId") }
      : {}),
  };
}

export function parseCreateAgent(value: unknown): CreateAgentInput {
  const body = object(value);
  return {
    workspaceId: string(body.workspaceId, "workspaceId") as string,
    name: string(body.name, "name") as string,
    role: string(body.role, "role") as string,
    description: optionalString(body.description, "description"),
    model: model(body.model),
    modelPolicy: body.modelPolicy === undefined ? "default" : modelPolicy(body.modelPolicy),
    modelName: optionalString(body.modelName, "modelName"),
    ...(body.reasoningEffort !== undefined
      ? { reasoningEffort: reasoningEffort(body.reasoningEffort) }
      : {}),
    mode: body.mode === undefined ? "worker" : agentMode(body.mode),
    avatarId: optionalString(body.avatarId, "avatarId"),
    skillIds: stringArray(body.skillIds ?? [], "skillIds"),
    permissions: permissions(body.permissions ?? {}),
    systemPrompt: optionalString(body.systemPrompt, "systemPrompt"),
  };
}

export function parseUpdateAgent(value: unknown): UpdateAgentInput {
  const body = object(value);
  return {
    ...(body.name !== undefined ? { name: string(body.name, "name") } : {}),
    ...(body.role !== undefined ? { role: string(body.role, "role") } : {}),
    ...(body.description !== undefined
      ? { description: optionalString(body.description, "description") }
      : {}),
    ...(body.model !== undefined ? { model: model(body.model) } : {}),
    ...(body.modelPolicy !== undefined ? { modelPolicy: modelPolicy(body.modelPolicy) } : {}),
    ...(body.modelName !== undefined
      ? { modelName: optionalString(body.modelName, "modelName") }
      : {}),
    ...(body.reasoningEffort !== undefined
      ? { reasoningEffort: reasoningEffort(body.reasoningEffort) }
      : {}),
    ...(body.mode !== undefined ? { mode: agentMode(body.mode) } : {}),
    ...(body.avatarId !== undefined ? { avatarId: optionalString(body.avatarId, "avatarId") } : {}),
    ...(body.skillIds !== undefined ? { skillIds: stringArray(body.skillIds, "skillIds") } : {}),
    ...(body.permissions !== undefined ? { permissions: permissions(body.permissions) } : {}),
    ...(body.systemPrompt !== undefined
      ? { systemPrompt: optionalString(body.systemPrompt, "systemPrompt") }
      : {}),
  };
}

/** 스킬 폴더 이름 규칙(Agent Skills 표준): 소문자, 숫자, `-`, 64자 이하 */
export const SKILL_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function parseCreateSkill(value: unknown): CreateSkillInput {
  const body = object(value);
  const requiredPermissions = stringArray(body.requiredPermissions ?? [], "requiredPermissions");
  for (const permission of requiredPermissions) {
    if (!["fileRead", "fileWrite", "terminal", "git", "browser", "figma"].includes(permission)) {
      throw new DomainError("INVALID_FIELD", `Unknown required permission: ${permission}`);
    }
  }
  const id = optionalString(body.id, "id");
  if (id !== undefined && !SKILL_ID_PATTERN.test(id)) {
    throw new DomainError(
      "INVALID_FIELD",
      "id must use lowercase letters, numbers and hyphens (max 64 characters)",
    );
  }
  return {
    ...(id ? { id } : {}),
    title: string(body.title ?? body.name, "title") as string,
    category: string(body.category, "category") as string,
    description: string(body.description, "description") as string,
    instructions: string(body.instructions, "instructions") as string,
    requiredPermissions: requiredPermissions as CreateSkillInput["requiredPermissions"],
  };
}

function optionalResultFormat(value: unknown): ResultFormat | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isResultFormat(value)) {
    throw new DomainError(
      "INVALID_FIELD",
      `resultFormat must be one of ${RESULT_FORMATS.join(", ")}`,
    );
  }
  return value;
}

export function parseCreateTask(value: unknown): CreateTaskInput {
  const body = object(value);
  const priority = body.priority;
  if (
    priority !== undefined &&
    priority !== "low" &&
    priority !== "medium" &&
    priority !== "high"
  ) {
    throw new DomainError("INVALID_FIELD", "priority must be low, medium, or high");
  }
  if (body.origin !== undefined && body.origin !== "office" && body.origin !== "chat") {
    throw new DomainError("INVALID_FIELD", "origin must be office or chat");
  }
  return {
    workspaceId: string(body.workspaceId, "workspaceId") as string,
    title: string(body.title, "title") as string,
    description: optionalString(body.description, "description"),
    assigneeAgentId: optionalString(body.assigneeAgentId, "assigneeAgentId"),
    dueDate: optionalString(body.dueDate, "dueDate"),
    priority,
    projectId: optionalString(body.projectId, "projectId"),
    origin: (body.origin as CreateTaskInput["origin"]) ?? "office",
    resultFormat: optionalResultFormat(body.resultFormat),
  };
}

export function parseUpdateTask(value: unknown): UpdateTaskInput {
  const body = object(value);
  const seed = parseCreateTask({
    workspaceId: "placeholder",
    title: body.title ?? "placeholder",
    ...body,
  });
  const result: UpdateTaskInput = {};
  for (const key of [
    "title",
    "description",
    "assigneeAgentId",
    "dueDate",
    "priority",
    "projectId",
  ] as const) {
    if (body[key] !== undefined) Object.assign(result, { [key]: seed[key] });
  }
  return result;
}
