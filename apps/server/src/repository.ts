import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  assertTaskTransition,
  DomainError,
  type ActivityLog,
  type ActivityType,
  type Agent,
  type AgentTaskTemplate,
  type AgentRun,
  type AgentRunStatus,
  type CreateAgentInput,
  type CreateAgentTaskTemplateInput,
  type CreateInputInput,
  type CreateSkillInput,
  type CreateTaskInput,
  type CreateWorkspaceInput,
  type Project,
  type Input,
  type InputStatus,
  type RunUsage,
  type RunProgressEvent,
  type Skill,
  type Task,
  type TaskResult,
  type TaskReview,
  type TaskStatus,
  type TaskWorkflowStep,
  type UpdateAgentInput,
  type UpdateInputInput,
  type UpdateSkillInput,
  type UpdateTaskInput,
  type UpdateWorkspaceInput,
  type Workspace,
  type WorkflowPreset,
  type WorkflowStepStatus,
} from "../../../packages/domain/src/index.ts";
import { requireEntity } from "./database.ts";
import type { AppDatabase } from "./database.ts";

type Row = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function optional(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function workspaceFrom(row: Row): Workspace {
  return {
    id: String(row.id),
    name: String(row.name),
    workingDirectory: optional(row.working_directory),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function projectFrom(row: Row): Project {
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

function skillFrom(row: Row): Skill {
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

function taskFrom(row: Row): Task {
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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: optional(row.completed_at),
  };
}

function inputFrom(row: Row): Input {
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

function workflowStepFrom(row: Row): TaskWorkflowStep {
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

function workflowPresetFrom(row: Row): WorkflowPreset {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    agentIds: json<string[]>(row.agent_ids_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function taskTemplateFrom(row: Row): AgentTaskTemplate {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    title: String(row.title),
    description: optional(row.description),
    priority: row.priority as AgentTaskTemplate["priority"],
    createdAt: String(row.created_at),
  };
}

function runFrom(row: Row): AgentRun {
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
    workingDirectory: optional(row.working_directory),
    error: optional(row.error),
    cleanupPolicy: row.cleanup_policy as AgentRun["cleanupPolicy"],
    createdAt: String(row.created_at),
  };
}

export class Repository {
  private readonly database: AppDatabase;

  constructor(database: AppDatabase) {
    this.database = database;
  }

  close(): void {
    this.database.close();
  }

  listWorkspaces(): Workspace[] {
    return this.database
      .prepare("SELECT * FROM workspaces ORDER BY created_at")
      .all()
      .map((row) => workspaceFrom(row as Row));
  }

  getWorkspace(id: string): Workspace | undefined {
    const row = this.database.prepare("SELECT * FROM workspaces WHERE id = ?").get(id);
    return row ? workspaceFrom(row as Row) : undefined;
  }

  createWorkspace(input: CreateWorkspaceInput): Workspace {
    const createdAt = now();
    const workspace: Workspace = { id: randomUUID(), ...input, createdAt, updatedAt: createdAt };
    this.database
      .prepare(
        "INSERT INTO workspaces (id, name, working_directory, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        workspace.id,
        workspace.name,
        workspace.workingDirectory ?? null,
        workspace.createdAt,
        workspace.updatedAt,
      );
    return workspace;
  }

  updateWorkspace(id: string, input: UpdateWorkspaceInput): Workspace {
    const current = requireEntity(this.getWorkspace(id), "Workspace", id);
    const updated = { ...current, ...input, updatedAt: now() };
    this.database
      .prepare("UPDATE workspaces SET name = ?, working_directory = ?, updated_at = ? WHERE id = ?")
      .run(updated.name, updated.workingDirectory ?? null, updated.updatedAt, id);
    return updated;
  }

  deleteWorkspace(id: string): void {
    this.requireChanged(
      this.database.prepare("DELETE FROM workspaces WHERE id = ?").run(id),
      "Workspace",
      id,
    );
  }

  listProjectDirectories(workspaceId: string): Project[] {
    return this.database
      .prepare("SELECT * FROM projects WHERE workspace_id = ? ORDER BY status, updated_at DESC")
      .all(workspaceId)
      .map((row) => projectFrom(row as Row));
  }

  getProject(id: string): Project | undefined {
    const row = this.database.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    return row ? projectFrom(row as Row) : undefined;
  }

  createProjectDirectory(
    input: Pick<Project, "workspaceId" | "name"> &
      Partial<Pick<Project, "description" | "status" | "figmaUrl" | "path">>,
  ): Project {
    requireEntity(this.getWorkspace(input.workspaceId), "Workspace", input.workspaceId);
    const createdAt = now();
    const project: Project = {
      id: randomUUID(),
      ...input,
      status: input.status ?? "active",
      createdAt,
      updatedAt: createdAt,
    };
    this.database
      .prepare(
        `INSERT INTO projects
      (id, workspace_id, name, description, status, figma_url, working_directory, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        project.id,
        project.workspaceId,
        project.name,
        project.description ?? null,
        project.status,
        project.figmaUrl ?? null,
        project.path ?? null,
        project.createdAt,
        project.updatedAt,
      );
    return project;
  }

  updateProject(
    id: string,
    input: Partial<Pick<Project, "name" | "description" | "status" | "figmaUrl" | "path">>,
  ): Project {
    const current = requireEntity(this.getProject(id), "Project", id);
    const updated: Project = { ...current, ...input, updatedAt: now() };
    this.database
      .prepare(
        "UPDATE projects SET name = ?, description = ?, status = ?, figma_url = ?, working_directory = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        updated.name,
        updated.description ?? null,
        updated.status,
        updated.figmaUrl ?? null,
        updated.path ?? null,
        updated.updatedAt,
        id,
      );
    return updated;
  }

  deleteProjectDirectory(id: string): void {
    this.transaction(() => {
      this.database.prepare("UPDATE tasks SET project_id = NULL WHERE project_id = ?").run(id);
      this.requireChanged(
        this.database.prepare("DELETE FROM projects WHERE id = ?").run(id),
        "Project",
        id,
      );
    });
  }

  listSkills(workspaceId?: string): Skill[] {
    const rows = workspaceId
      ? this.database
          .prepare(
            "SELECT * FROM skills WHERE workspace_id IS NULL OR workspace_id = ? ORDER BY category, name",
          )
          .all(workspaceId)
      : this.database.prepare("SELECT * FROM skills ORDER BY category, name").all();
    return rows.map((row) => skillFrom(row as Row));
  }

  getSkill(id: string): Skill | undefined {
    const row = this.database.prepare("SELECT * FROM skills WHERE id = ?").get(id);
    return row ? skillFrom(row as Row) : undefined;
  }

  createSkill(input: CreateSkillInput): Skill {
    if (input.workspaceId)
      requireEntity(this.getWorkspace(input.workspaceId), "Workspace", input.workspaceId);
    const createdAt = now();
    const skill: Skill = { id: randomUUID(), ...input, createdAt, updatedAt: createdAt };
    this.database
      .prepare(
        `INSERT INTO skills
        (id, workspace_id, name, category, description, instructions, tools_json,
         required_permissions_json, output_schema_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        skill.id,
        skill.workspaceId ?? null,
        skill.name,
        skill.category,
        skill.description,
        skill.instructions,
        JSON.stringify(skill.tools),
        JSON.stringify(skill.requiredPermissions ?? []),
        skill.outputSchema ? JSON.stringify(skill.outputSchema) : null,
        skill.createdAt,
        skill.updatedAt,
      );
    return skill;
  }

  updateSkill(id: string, input: UpdateSkillInput): Skill {
    const current = requireEntity(this.getSkill(id), "Skill", id);
    const updated: Skill = { ...current, ...input, updatedAt: now() };
    this.database
      .prepare(
        `UPDATE skills SET name = ?, category = ?, description = ?, instructions = ?,
        tools_json = ?, required_permissions_json = ?, output_schema_json = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        updated.name,
        updated.category,
        updated.description,
        updated.instructions,
        JSON.stringify(updated.tools),
        JSON.stringify(updated.requiredPermissions ?? []),
        updated.outputSchema ? JSON.stringify(updated.outputSchema) : null,
        updated.updatedAt,
        id,
      );
    return updated;
  }

  deleteSkill(id: string): void {
    try {
      this.requireChanged(
        this.database.prepare("DELETE FROM skills WHERE id = ?").run(id),
        "Skill",
        id,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("FOREIGN KEY")) {
        throw new DomainError(
          "SKILL_IN_USE",
          "이 스킬을 사용하는 에이전트가 있습니다. 에이전트 설정에서 스킬 연결을 먼저 해제해 주세요.",
          409,
        );
      }
      throw error;
    }
  }

  listAgents(workspaceId?: string): Agent[] {
    const rows = workspaceId
      ? this.database
          .prepare("SELECT * FROM agents WHERE workspace_id = ? ORDER BY created_at")
          .all(workspaceId)
      : this.database.prepare("SELECT * FROM agents ORDER BY created_at").all();
    return rows.map((row) => this.agentFrom(row as Row));
  }

  getAgent(id: string): Agent | undefined {
    const row = this.database.prepare("SELECT * FROM agents WHERE id = ?").get(id);
    return row ? this.agentFrom(row as Row) : undefined;
  }

  createAgent(input: CreateAgentInput): Agent {
    requireEntity(this.getWorkspace(input.workspaceId), "Workspace", input.workspaceId);
    this.assertSkillScope(input.workspaceId, input.skillIds);
    const createdAt = now();
    const agent: Agent = {
      id: randomUUID(),
      ...input,
      modelPolicy: input.modelPolicy ?? "default",
      mode: input.mode ?? "worker",
      createdAt,
      updatedAt: createdAt,
    };
    this.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO agents
          (id, workspace_id, name, role, description, model, model_policy, model_name, reasoning_effort, mode, avatar_id, permissions_json, system_prompt, working_directory, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          agent.id,
          agent.workspaceId,
          agent.name,
          agent.role,
          agent.description ?? null,
          agent.model,
          agent.modelPolicy ?? "default",
          agent.modelName ?? null,
          agent.reasoningEffort ?? null,
          agent.mode,
          agent.avatarId ?? null,
          JSON.stringify(agent.permissions),
          agent.systemPrompt ?? null,
          agent.workingDirectory ?? null,
          agent.createdAt,
          agent.updatedAt,
        );
      this.replaceAgentSkills(agent.id, agent.skillIds);
    });
    this.createActivity({
      workspaceId: agent.workspaceId,
      type: "agent_created",
      agentId: agent.id,
      message: `Agent created: ${agent.name}`,
    });
    return agent;
  }

  updateAgent(id: string, input: UpdateAgentInput): Agent {
    const current = requireEntity(this.getAgent(id), "Agent", id);
    const updated: Agent = { ...current, ...input, updatedAt: now() };
    this.assertSkillScope(updated.workspaceId, updated.skillIds);
    this.transaction(() => {
      this.database
        .prepare(
          `UPDATE agents SET name = ?, role = ?, description = ?, model = ?, model_policy = ?, model_name = ?, reasoning_effort = ?, mode = ?, avatar_id = ?,
          permissions_json = ?, system_prompt = ?, working_directory = ?, updated_at = ? WHERE id = ?`,
        )
        .run(
          updated.name,
          updated.role,
          updated.description ?? null,
          updated.model,
          updated.modelPolicy ?? "default",
          updated.modelName ?? null,
          updated.reasoningEffort ?? null,
          updated.mode,
          updated.avatarId ?? null,
          JSON.stringify(updated.permissions),
          updated.systemPrompt ?? null,
          updated.workingDirectory ?? null,
          updated.updatedAt,
          id,
        );
      this.replaceAgentSkills(id, updated.skillIds);
    });
    return updated;
  }

  deleteAgent(id: string): void {
    try {
      this.requireChanged(
        this.database.prepare("DELETE FROM agents WHERE id = ?").run(id),
        "Agent",
        id,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("FOREIGN KEY")) {
        throw new DomainError(
          "AGENT_HAS_RUNS",
          "실행 기록이 있는 에이전트는 삭제할 수 없습니다.",
          409,
        );
      }
      throw error;
    }
  }

  listAgentTaskTemplates(agentId: string): AgentTaskTemplate[] {
    requireEntity(this.getAgent(agentId), "Agent", agentId);
    return this.database
      .prepare("SELECT * FROM agent_task_templates WHERE agent_id = ? ORDER BY created_at DESC")
      .all(agentId)
      .map((row) => taskTemplateFrom(row as Row));
  }

  createAgentTaskTemplate(input: CreateAgentTaskTemplateInput): AgentTaskTemplate {
    requireEntity(this.getAgent(input.agentId), "Agent", input.agentId);
    const template: AgentTaskTemplate = {
      id: randomUUID(),
      agentId: input.agentId,
      title: input.title,
      description: input.description,
      priority: input.priority ?? "medium",
      createdAt: now(),
    };
    this.database
      .prepare(
        `INSERT INTO agent_task_templates
        (id, agent_id, title, description, priority, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        template.id,
        template.agentId,
        template.title,
        template.description ?? null,
        template.priority,
        template.createdAt,
      );
    return template;
  }

  deleteAgentTaskTemplate(agentId: string, id: string): void {
    this.requireChanged(
      this.database
        .prepare("DELETE FROM agent_task_templates WHERE id = ? AND agent_id = ?")
        .run(id, agentId),
      "AgentTaskTemplate",
      id,
    );
  }

  listTasks(workspaceId?: string, status?: TaskStatus): Task[] {
    let rows: Row[];
    if (workspaceId && status) {
      rows = this.database
        .prepare(
          "SELECT * FROM tasks WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC",
        )
        .all(workspaceId, status) as Row[];
    } else if (workspaceId) {
      rows = this.database
        .prepare("SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC")
        .all(workspaceId) as Row[];
    } else {
      rows = this.database.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() as Row[];
    }
    return rows.map(taskFrom);
  }

  getTask(id: string): Task | undefined {
    const row = this.database.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    return row ? taskFrom(row as Row) : undefined;
  }

  createTask(input: CreateTaskInput): Task {
    requireEntity(this.getWorkspace(input.workspaceId), "Workspace", input.workspaceId);
    if (input.assigneeAgentId) this.assertAgentWorkspace(input.assigneeAgentId, input.workspaceId);
    if (input.projectId) this.assertProjectWorkspace(input.projectId, input.workspaceId);
    const createdAt = now();
    const task: Task = {
      id: randomUUID(),
      ...input,
      status: "todo",
      createdAt,
      updatedAt: createdAt,
    };
    this.database
      .prepare(
        `INSERT INTO tasks
        (id, workspace_id, title, description, status, assignee_agent_id, source_input_id,
         due_date, priority, project_id, working_directory, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.workspaceId,
        task.title,
        task.description ?? null,
        task.status,
        task.assigneeAgentId ?? null,
        task.sourceInputId ?? null,
        task.dueDate ?? null,
        task.priority ?? null,
        task.projectId ?? null,
        task.workingDirectory ?? null,
        task.createdAt,
        task.updatedAt,
      );
    this.createActivity({
      workspaceId: task.workspaceId,
      type: "task_created",
      taskId: task.id,
      message: `Task created: ${task.title}`,
    });
    return task;
  }

  updateTask(id: string, input: UpdateTaskInput): Task {
    const current = requireEntity(this.getTask(id), "Task", id);
    const updated: Task = { ...current, ...input, updatedAt: now() };
    if (updated.assigneeAgentId)
      this.assertAgentWorkspace(updated.assigneeAgentId, updated.workspaceId);
    if (updated.projectId) this.assertProjectWorkspace(updated.projectId, updated.workspaceId);
    this.writeTask(updated);
    return updated;
  }

  transitionTask(id: string, status: TaskStatus, result?: TaskResult): Task {
    const current = requireEntity(this.getTask(id), "Task", id);
    assertTaskTransition(current.status, status);
    const updated: Task = {
      ...current,
      status,
      ...(result !== undefined ? { result } : {}),
      updatedAt: now(),
      completedAt: status === "done" ? now() : undefined,
    };
    this.writeTask(updated);
    return updated;
  }

  deleteTask(id: string): void {
    this.requireChanged(
      this.database.prepare("DELETE FROM tasks WHERE id = ?").run(id),
      "Task",
      id,
    );
  }

  listInputs(workspaceId: string, status?: InputStatus): Input[] {
    requireEntity(this.getWorkspace(workspaceId), "Workspace", workspaceId);
    const rows = status
      ? this.database
          .prepare(
            "SELECT * FROM inputs WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC, rowid DESC",
          )
          .all(workspaceId, status)
      : this.database
          .prepare(
            "SELECT * FROM inputs WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC",
          )
          .all(workspaceId);
    return rows.map((row) => inputFrom(row as Row));
  }

  getInput(id: string): Input | undefined {
    const row = this.database.prepare("SELECT * FROM inputs WHERE id = ?").get(id);
    return row ? inputFrom(row as Row) : undefined;
  }

  createInput(input: CreateInputInput): Input {
    requireEntity(this.getWorkspace(input.workspaceId), "Workspace", input.workspaceId);
    const createdAt = now();
    const captured: Input = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      type: input.type ?? "request",
      title: input.title,
      content: input.content,
      status: "inbox",
      createdAt,
      updatedAt: createdAt,
    };
    this.database
      .prepare(
        `INSERT INTO inputs (id, workspace_id, type, title, content, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        captured.id,
        captured.workspaceId,
        captured.type,
        captured.title ?? null,
        captured.content,
        captured.status,
        captured.createdAt,
        captured.updatedAt,
      );
    this.createActivity({
      workspaceId: captured.workspaceId,
      type: "input_created",
      message: `Inbox에 담음: ${captured.title ?? captured.content.slice(0, 60)}`,
      metadata: { inputId: captured.id },
    });
    return captured;
  }

  updateInput(id: string, input: UpdateInputInput): Input {
    const current = requireEntity(this.getInput(id), "Input", id);
    if (current.status === "converted") {
      throw new DomainError(
        "INPUT_ALREADY_CONVERTED",
        "이미 작업으로 전환된 Inbox 항목입니다.",
        409,
      );
    }
    const updated: Input = { ...current, ...input, updatedAt: now() };
    this.writeInput(updated);
    if (updated.status === "archived" && current.status !== "archived") {
      this.createActivity({
        workspaceId: updated.workspaceId,
        type: "input_archived",
        message: `Inbox 보관: ${updated.title ?? updated.content.slice(0, 60)}`,
        metadata: { inputId: updated.id },
      });
    }
    return updated;
  }

  deleteInput(id: string): void {
    this.requireChanged(
      this.database.prepare("DELETE FROM inputs WHERE id = ?").run(id),
      "Input",
      id,
    );
  }

  convertInput(
    id: string,
    taskInput: Partial<
      Pick<CreateTaskInput, "title" | "description" | "assigneeAgentId" | "priority" | "projectId">
    >,
  ): { input: Input; task: Task } {
    return this.transaction(() => {
      const captured = requireEntity(this.getInput(id), "Input", id);
      if (captured.status === "converted") {
        throw new DomainError(
          "INPUT_ALREADY_CONVERTED",
          "이미 작업으로 전환된 Inbox 항목입니다.",
          409,
        );
      }
      const task = this.createTask({
        workspaceId: captured.workspaceId,
        title: taskInput.title ?? captured.title ?? captured.content.slice(0, 80),
        description: taskInput.description ?? captured.content,
        assigneeAgentId: taskInput.assigneeAgentId,
        priority: taskInput.priority ?? "medium",
        projectId: taskInput.projectId,
        sourceInputId: captured.id,
      });
      const converted: Input = { ...captured, status: "converted", updatedAt: now() };
      this.writeInput(converted);
      this.createActivity({
        workspaceId: converted.workspaceId,
        type: "input_converted",
        taskId: task.id,
        message: `Inbox에서 작업 생성: ${task.title}`,
        metadata: { inputId: converted.id },
      });
      return { input: converted, task };
    });
  }

  listWorkflowSteps(taskId: string): TaskWorkflowStep[] {
    return this.database
      .prepare("SELECT * FROM task_workflow_steps WHERE task_id = ? ORDER BY position")
      .all(taskId)
      .map((row) => workflowStepFrom(row as Row));
  }

  listWorkflowPresets(workspaceId: string): WorkflowPreset[] {
    requireEntity(this.getWorkspace(workspaceId), "Workspace", workspaceId);
    return this.database
      .prepare("SELECT * FROM workflow_presets WHERE workspace_id = ? ORDER BY updated_at DESC")
      .all(workspaceId)
      .map((row) => workflowPresetFrom(row as Row));
  }

  createWorkflowPreset(input: {
    workspaceId: string;
    name: string;
    agentIds: string[];
  }): WorkflowPreset {
    requireEntity(this.getWorkspace(input.workspaceId), "Workspace", input.workspaceId);
    const name = input.name.trim();
    if (!name) throw new DomainError("INVALID_WORKFLOW_PRESET", "협업 그룹 이름을 입력해 주세요.");
    if (input.agentIds.length < 2 || input.agentIds.length > 8) {
      throw new DomainError(
        "INVALID_WORKFLOW_PRESET",
        "협업 그룹은 2명 이상 8명 이하의 에이전트로 구성해 주세요.",
      );
    }
    if (new Set(input.agentIds).size !== input.agentIds.length) {
      throw new DomainError(
        "INVALID_WORKFLOW_PRESET",
        "같은 에이전트를 협업 그룹에 중복 배치할 수 없습니다.",
      );
    }
    for (const agentId of input.agentIds) this.assertAgentWorkspace(agentId, input.workspaceId);
    const createdAt = now();
    const preset: WorkflowPreset = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      name,
      agentIds: [...input.agentIds],
      createdAt,
      updatedAt: createdAt,
    };
    try {
      this.database
        .prepare(
          `INSERT INTO workflow_presets
          (id, workspace_id, name, agent_ids_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          preset.id,
          preset.workspaceId,
          preset.name,
          JSON.stringify(preset.agentIds),
          preset.createdAt,
          preset.updatedAt,
        );
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        throw new DomainError(
          "WORKFLOW_PRESET_EXISTS",
          "같은 이름의 협업 그룹이 이미 있습니다.",
          409,
        );
      }
      throw error;
    }
    return preset;
  }

  deleteWorkflowPreset(id: string): void {
    this.requireChanged(
      this.database.prepare("DELETE FROM workflow_presets WHERE id = ?").run(id),
      "WorkflowPreset",
      id,
    );
  }

  getWorkflowStepByRun(runId: string): TaskWorkflowStep | undefined {
    const row = this.database
      .prepare("SELECT * FROM task_workflow_steps WHERE run_id = ?")
      .get(runId);
    return row ? workflowStepFrom(row as Row) : undefined;
  }

  setTaskWorkflow(taskId: string, agentIds: string[]): TaskWorkflowStep[] {
    const task = requireEntity(this.getTask(taskId), "Task", taskId);
    if (task.status !== "todo" || this.listRuns(taskId).length > 0) {
      throw new DomainError(
        "WORKFLOW_ALREADY_STARTED",
        "실행 기록이 없는 Todo 작업에서만 Workflow를 변경할 수 있습니다.",
        409,
      );
    }
    if (agentIds.length === 1 || agentIds.length > 8) {
      throw new DomainError(
        "INVALID_WORKFLOW",
        "Workflow는 2명 이상 8명 이하의 에이전트로 구성해 주세요.",
      );
    }
    if (new Set(agentIds).size !== agentIds.length) {
      throw new DomainError("INVALID_WORKFLOW", "같은 에이전트를 중복 배치할 수 없습니다.");
    }
    for (const agentId of agentIds) this.assertAgentWorkspace(agentId, task.workspaceId);

    const steps = this.transaction(() => {
      this.database.prepare("DELETE FROM task_workflow_steps WHERE task_id = ?").run(taskId);
      const insert = this.database.prepare(
        `INSERT INTO task_workflow_steps
        (id, task_id, agent_id, position, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      );
      const createdAt = now();
      const created = agentIds.map((agentId, position) => {
        const step: TaskWorkflowStep = {
          id: randomUUID(),
          taskId,
          agentId,
          position,
          status: "pending",
          createdAt,
          updatedAt: createdAt,
        };
        insert.run(step.id, taskId, agentId, position, createdAt, createdAt);
        return step;
      });
      if (agentIds[0]) this.updateTask(taskId, { assigneeAgentId: agentIds[0] });
      return created;
    });
    this.createActivity({
      workspaceId: task.workspaceId,
      type: "workflow_configured",
      taskId,
      message:
        steps.length > 0 ? `${steps.length}단계 순차 Workflow 구성` : "순차 Workflow 사용 안 함",
    });
    return steps;
  }

  updateWorkflowStep(
    id: string,
    input: Partial<Pick<TaskWorkflowStep, "status" | "runId" | "result">>,
  ): TaskWorkflowStep {
    const currentRow = this.database
      .prepare("SELECT * FROM task_workflow_steps WHERE id = ?")
      .get(id);
    const current = requireEntity(
      currentRow ? workflowStepFrom(currentRow as Row) : undefined,
      "WorkflowStep",
      id,
    );
    const updated = { ...current, ...input, updatedAt: now() };
    this.database
      .prepare(
        `UPDATE task_workflow_steps SET status = ?, run_id = ?, result_json = ?, updated_at = ?
        WHERE id = ?`,
      )
      .run(
        updated.status,
        updated.runId ?? null,
        updated.result ? JSON.stringify(updated.result) : null,
        updated.updatedAt,
        id,
      );
    return updated;
  }

  resetFailedWorkflowStep(taskId: string): TaskWorkflowStep | undefined {
    const failed = this.listWorkflowSteps(taskId).find((step) => step.status === "failed");
    return failed
      ? this.updateWorkflowStep(failed.id, { status: "pending", runId: undefined })
      : undefined;
  }

  createRun(
    input: Pick<
      AgentRun,
      | "id"
      | "taskId"
      | "agentId"
      | "runtime"
      | "cleanupPolicy"
      | "modelPolicy"
      | "modelName"
      | "reasoningEffort"
      | "request"
      | "workingDirectory"
    >,
  ): AgentRun {
    const run: AgentRun = { ...input, status: "queued", createdAt: now() };
    this.database
      .prepare(
        `INSERT INTO agent_runs
        (id, task_id, agent_id, runtime, model_policy, model_name, reasoning_effort, status,
         request_text, working_directory, cleanup_policy, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.id,
        run.taskId,
        run.agentId,
        run.runtime,
        run.modelPolicy ?? "default",
        run.modelName ?? null,
        run.reasoningEffort ?? null,
        run.status,
        run.request ?? null,
        run.workingDirectory ?? null,
        run.cleanupPolicy,
        run.createdAt,
      );
    return run;
  }

  getRun(id: string): AgentRun | undefined {
    const row = this.database.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id);
    return row ? runFrom(row as Row) : undefined;
  }

  listRuns(taskId?: string): AgentRun[] {
    const rows = taskId
      ? this.database
          .prepare("SELECT * FROM agent_runs WHERE task_id = ? ORDER BY created_at DESC")
          .all(taskId)
      : this.database.prepare("SELECT * FROM agent_runs ORDER BY created_at DESC").all();
    return rows.map((row) => runFrom(row as Row));
  }

  createRunProgress(input: Omit<RunProgressEvent, "id" | "createdAt">): RunProgressEvent {
    requireEntity(this.getRun(input.runId), "AgentRun", input.runId);
    const progress: RunProgressEvent = { id: randomUUID(), ...input, createdAt: now() };
    this.database
      .prepare(
        `INSERT INTO run_progress_events
      (id, run_id, type, message, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        progress.id,
        progress.runId,
        progress.type,
        progress.message.slice(0, 4_000),
        progress.metadata ? JSON.stringify(progress.metadata) : null,
        progress.createdAt,
      );
    return progress;
  }

  listRunProgress(runId: string, limit = 100): RunProgressEvent[] {
    return this.database
      .prepare(
        "SELECT * FROM run_progress_events WHERE run_id = ? ORDER BY created_at, rowid LIMIT ?",
      )
      .all(runId, Math.min(Math.max(limit, 1), 300))
      .map((raw) => {
        const row = raw as Row;
        return {
          id: String(row.id),
          runId: String(row.run_id),
          type: row.type as RunProgressEvent["type"],
          message: String(row.message),
          metadata: json<Record<string, unknown> | undefined>(row.metadata_json, undefined),
          createdAt: String(row.created_at),
        };
      });
  }

  recoverInterruptedRuns(): number {
    const interrupted = this.database
      .prepare(
        "SELECT * FROM agent_runs WHERE status IN ('queued', 'running', 'waiting') ORDER BY created_at",
      )
      .all()
      .map((row) => runFrom(row as Row));
    if (interrupted.length === 0) return 0;

    this.transaction(() => {
      for (const run of interrupted) {
        const error = "Server restarted while the AgentRun was active. Retry the task to continue.";
        this.updateRun(run.id, { status: "failed", finishedAt: now(), error });
        const workflowStep = this.getWorkflowStepByRun(run.id);
        if (workflowStep) this.updateWorkflowStep(workflowStep.id, { status: "failed" });
        const task = this.getTask(run.taskId);
        if (task && ["working", "needs_input", "blocked"].includes(task.status)) {
          const failedTask = this.transitionTask(task.id, "failed");
          this.createActivity({
            workspaceId: failedTask.workspaceId,
            type: "task_failed",
            taskId: failedTask.id,
            agentId: run.agentId,
            runId: run.id,
            message: error,
          });
        }
      }
    });
    return interrupted.length;
  }

  latestRun(taskId: string): AgentRun | undefined {
    const row = this.database
      .prepare("SELECT * FROM agent_runs WHERE task_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(taskId);
    return row ? runFrom(row as Row) : undefined;
  }

  updateRun(
    id: string,
    patch: Partial<
      Pick<
        AgentRun,
        | "status"
        | "runtimeThreadId"
        | "startedAt"
        | "finishedAt"
        | "eventLogRef"
        | "usage"
        | "result"
        | "error"
      >
    >,
  ): AgentRun {
    const current = requireEntity(this.getRun(id), "AgentRun", id);
    const updated = { ...current, ...patch };
    this.database
      .prepare(
        `UPDATE agent_runs SET status = ?, runtime_thread_id = ?, started_at = ?,
        finished_at = ?, event_log_ref = ?, usage_json = ?, result_json = ?, error = ? WHERE id = ?`,
      )
      .run(
        updated.status,
        updated.runtimeThreadId ?? null,
        updated.startedAt ?? null,
        updated.finishedAt ?? null,
        updated.eventLogRef ?? null,
        updated.usage ? JSON.stringify(updated.usage) : null,
        updated.result ? JSON.stringify(updated.result) : null,
        updated.error ?? null,
        id,
      );
    return updated;
  }

  createReview(input: Omit<TaskReview, "id" | "createdAt">): TaskReview {
    const review: TaskReview = { id: randomUUID(), ...input, createdAt: now() };
    this.database
      .prepare(
        "INSERT INTO task_reviews (id, task_id, run_id, action, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        review.id,
        review.taskId,
        review.runId ?? null,
        review.action,
        review.feedback ?? null,
        review.createdAt,
      );
    return review;
  }

  listReviews(taskId: string): TaskReview[] {
    return this.database
      .prepare("SELECT * FROM task_reviews WHERE task_id = ? ORDER BY created_at DESC")
      .all(taskId)
      .map((raw) => {
        const row = raw as Row;
        return {
          id: String(row.id),
          taskId: String(row.task_id),
          runId: optional(row.run_id),
          action: row.action as TaskReview["action"],
          feedback: optional(row.feedback),
          createdAt: String(row.created_at),
        };
      });
  }

  createActivity(input: {
    workspaceId: string;
    type: ActivityType;
    message: string;
    agentId?: string;
    taskId?: string;
    runId?: string;
    metadata?: Record<string, unknown>;
  }): ActivityLog {
    const activity: ActivityLog = { id: randomUUID(), ...input, createdAt: now() };
    this.database
      .prepare(
        `INSERT INTO activity_logs
        (id, workspace_id, type, agent_id, task_id, run_id, message, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        activity.id,
        activity.workspaceId,
        activity.type,
        activity.agentId ?? null,
        activity.taskId ?? null,
        activity.runId ?? null,
        activity.message,
        activity.metadata ? JSON.stringify(activity.metadata) : null,
        activity.createdAt,
      );
    return activity;
  }

  listActivities(workspaceId: string, limit = 100): ActivityLog[] {
    return this.database
      .prepare(
        "SELECT * FROM activity_logs WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
      )
      .all(workspaceId, Math.min(Math.max(limit, 1), 500))
      .map((raw) => {
        const row = raw as Row;
        return {
          id: String(row.id),
          workspaceId: String(row.workspace_id),
          type: row.type as ActivityType,
          agentId: optional(row.agent_id),
          taskId: optional(row.task_id),
          runId: optional(row.run_id),
          message: String(row.message),
          metadata: json<Record<string, unknown> | undefined>(row.metadata_json, undefined),
          createdAt: String(row.created_at),
        };
      });
  }

  private agentFrom(row: Row): Agent {
    const skillRows = this.database
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

  private assertSkillScope(workspaceId: string, skillIds: string[]): void {
    for (const skillId of skillIds) {
      const skill = requireEntity(this.getSkill(skillId), "Skill", skillId);
      if (skill.workspaceId && skill.workspaceId !== workspaceId) {
        throw new DomainError(
          "SKILL_SCOPE_MISMATCH",
          `Skill ${skillId} belongs to another workspace`,
          422,
        );
      }
    }
  }

  private assertAgentWorkspace(agentId: string, workspaceId: string): void {
    const agent = requireEntity(this.getAgent(agentId), "Agent", agentId);
    if (agent.workspaceId !== workspaceId) {
      throw new DomainError("AGENT_SCOPE_MISMATCH", "Agent belongs to another workspace", 422);
    }
  }

  private assertProjectWorkspace(projectId: string, workspaceId: string): void {
    const project = requireEntity(this.getProject(projectId), "Project", projectId);
    if (project.workspaceId !== workspaceId) {
      throw new DomainError("PROJECT_SCOPE_MISMATCH", "Project belongs to another workspace", 422);
    }
  }

  private replaceAgentSkills(agentId: string, skillIds: string[]): void {
    this.database.prepare("DELETE FROM agent_skills WHERE agent_id = ?").run(agentId);
    const insert = this.database.prepare(
      "INSERT INTO agent_skills (agent_id, skill_id) VALUES (?, ?)",
    );
    for (const skillId of skillIds) insert.run(agentId, skillId);
  }

  private writeTask(task: Task): void {
    this.database
      .prepare(
        `UPDATE tasks SET title = ?, description = ?, status = ?, assignee_agent_id = ?,
        source_input_id = ?, due_date = ?, priority = ?, project_id = ?, working_directory = ?, result_json = ?, updated_at = ?, completed_at = ?
        WHERE id = ?`,
      )
      .run(
        task.title,
        task.description ?? null,
        task.status,
        task.assigneeAgentId ?? null,
        task.sourceInputId ?? null,
        task.dueDate ?? null,
        task.priority ?? null,
        task.projectId ?? null,
        task.workingDirectory ?? null,
        task.result ? JSON.stringify(task.result) : null,
        task.updatedAt,
        task.completedAt ?? null,
        task.id,
      );
  }

  private writeInput(input: Input): void {
    this.database
      .prepare(
        `UPDATE inputs SET type = ?, title = ?, content = ?, status = ?, updated_at = ? WHERE id = ?`,
      )
      .run(input.type, input.title ?? null, input.content, input.status, input.updatedAt, input.id);
  }

  private transaction<T>(action: () => T): T {
    return this.database.transaction(action).immediate();
  }

  private requireChanged(result: Database.RunResult, entity: string, id: string): void {
    if (result.changes === 0) throw new DomainError("NOT_FOUND", `${entity} not found: ${id}`, 404);
  }
}
