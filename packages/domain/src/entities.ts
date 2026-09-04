export type AgentModel = "claude" | "codex";
export type AgentMode = "worker" | "chat";
export type ModelPolicy = "default" | "auto" | "manual";
export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

export type AgentPermissions = {
  fileRead?: boolean;
  fileWrite?: boolean;
  terminal?: boolean;
  git?: boolean;
  browser?: boolean;
  figma?: boolean;
};

export type Workspace = {
  id: string;
  name: string;
  workingDirectory?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectStatus = "active" | "paused" | "done";

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  figmaUrl?: string;
  path?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDirectory = Project;

export type Agent = {
  id: string;
  workspaceId: string;
  name: string;
  role: string;
  description?: string;
  model: AgentModel;
  modelPolicy?: ModelPolicy;
  modelName?: string;
  reasoningEffort?: ReasoningEffort;
  mode: AgentMode;
  avatarId?: string;
  skillIds: string[];
  permissions: AgentPermissions;
  systemPrompt?: string;
  workingDirectory?: string;
  createdAt: string;
  updatedAt: string;
};

export type ToolBinding = {
  name: string;
  config?: Record<string, unknown>;
};

export type Skill = {
  id: string;
  workspaceId?: string;
  name: string;
  category: string;
  description: string;
  instructions: string;
  tools: ToolBinding[];
  requiredPermissions?: Array<keyof AgentPermissions>;
  outputSchema?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TaskStatus =
  "todo" | "working" | "needs_review" | "needs_input" | "blocked" | "done" | "failed";

export type TaskResult = {
  summary: string;
  artifacts?: Array<{ type: string; name: string; path?: string; url?: string }>;
  metadata?: Record<string, unknown>;
};

export type Task = {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assigneeAgentId?: string;
  sourceInputId?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  projectId?: string;
  workingDirectory?: string;
  result?: TaskResult;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type InputType = "request" | "feedback" | "idea" | "message" | "file";
export type InputStatus = "inbox" | "triaged" | "converted" | "archived";

export type Input = {
  id: string;
  workspaceId: string;
  type: InputType;
  title?: string;
  content: string;
  status: InputStatus;
  createdAt: string;
  updatedAt: string;
};

export type AgentTaskTemplate = {
  id: string;
  agentId: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  createdAt: string;
};

export type AgentRunStatus =
  "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export type RunUsage = {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  estimatedCost?: number;
};

export type AgentRun = {
  id: string;
  taskId: string;
  agentId: string;
  runtime: AgentModel;
  modelPolicy?: ModelPolicy;
  modelName?: string;
  reasoningEffort?: ReasoningEffort;
  status: AgentRunStatus;
  runtimeThreadId?: string;
  startedAt?: string;
  finishedAt?: string;
  eventLogRef?: string;
  usage?: RunUsage;
  request?: string;
  result?: TaskResult;
  workingDirectory?: string;
  error?: string;
  cleanupPolicy: "preserve" | "discard";
  createdAt: string;
};

export type WorkflowStepStatus = "pending" | "working" | "completed" | "failed";

export type TaskWorkflowStep = {
  id: string;
  taskId: string;
  agentId: string;
  position: number;
  status: WorkflowStepStatus;
  runId?: string;
  result?: TaskResult;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowPreset = {
  id: string;
  workspaceId: string;
  name: string;
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type RunProgressEvent = {
  id: string;
  runId: string;
  type: "started" | "message" | "tool_started" | "tool_completed" | "permission_requested";
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ActivityType =
  | "input_created"
  | "input_converted"
  | "input_archived"
  | "workflow_configured"
  | "workflow_step_started"
  | "workflow_step_completed"
  | "session_limit_warning"
  | "session_limit_reached"
  | "task_created"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "task_cancelled"
  | "approval_requested"
  | "approval_resolved"
  | "task_approved"
  | "change_requested"
  | "agent_created";

export type ActivityLog = {
  id: string;
  workspaceId: string;
  type: ActivityType;
  agentId?: string;
  taskId?: string;
  runId?: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type TaskReview = {
  id: string;
  taskId: string;
  runId?: string;
  action: "approved" | "changes_requested";
  feedback?: string;
  createdAt: string;
};

export type RunLimits = {
  maxDurationMs: number;
  idleTimeoutMs?: number;
  maxTurns: number;
  maxTokens?: number;
  maxEstimatedCost?: number;
};

export type CreateWorkspaceInput = Pick<Workspace, "name"> &
  Partial<Pick<Workspace, "workingDirectory">>;
export type UpdateWorkspaceInput = Partial<CreateWorkspaceInput>;

export type CreateAgentInput = Pick<
  Agent,
  "workspaceId" | "name" | "role" | "model" | "skillIds" | "permissions"
> &
  Partial<
    Pick<
      Agent,
      | "description"
      | "systemPrompt"
      | "avatarId"
      | "workingDirectory"
      | "mode"
      | "modelPolicy"
      | "modelName"
      | "reasoningEffort"
    >
  >;
export type UpdateAgentInput = Partial<Omit<CreateAgentInput, "workspaceId">>;

export type CreateSkillInput = Pick<
  Skill,
  "name" | "category" | "description" | "instructions" | "tools"
> &
  Partial<Pick<Skill, "workspaceId" | "requiredPermissions" | "outputSchema">>;
export type UpdateSkillInput = Partial<Omit<CreateSkillInput, "workspaceId">>;

export type CreateTaskInput = Pick<Task, "workspaceId" | "title"> &
  Partial<
    Pick<
      Task,
      | "description"
      | "assigneeAgentId"
      | "sourceInputId"
      | "dueDate"
      | "priority"
      | "workingDirectory"
      | "projectId"
    >
  >;
export type UpdateTaskInput = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "assigneeAgentId"
    | "dueDate"
    | "priority"
    | "workingDirectory"
    | "projectId"
  >
>;

export type CreateInputInput = Pick<Input, "workspaceId" | "content"> &
  Partial<Pick<Input, "type" | "title">>;
export type UpdateInputInput = Partial<Pick<Input, "type" | "title" | "content" | "status">>;

export type CreateAgentTaskTemplateInput = Pick<AgentTaskTemplate, "agentId" | "title"> &
  Partial<Pick<AgentTaskTemplate, "description" | "priority">>;
