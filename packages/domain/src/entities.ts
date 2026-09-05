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
export type ExecutionScopeType = "general" | "project";

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
  scopeType: ExecutionScopeType;
  scopeProjectId?: string;
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

export type KnowledgeDocument = {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  fileName: string;
  taskId?: string;
  runId?: string;
  referenceTaskIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateKnowledgeDocumentInput = Pick<
  KnowledgeDocument,
  "workspaceId" | "title" | "content"
> &
  Partial<Pick<KnowledgeDocument, "taskId" | "runId" | "referenceTaskIds">>;

export type UpdateKnowledgeDocumentInput = Partial<
  Pick<KnowledgeDocument, "title" | "content" | "taskId" | "runId" | "referenceTaskIds">
>;

export type RunLimits = {
  maxDurationMs: number;
  idleTimeoutMs?: number;
  maxTurns: number;
  maxTokens?: number;
  maxEstimatedCost?: number;
};

export type CreateWorkspaceInput = Pick<Workspace, "name">;
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
      "description" | "assigneeAgentId" | "sourceInputId" | "dueDate" | "priority" | "projectId"
    >
  >;
export type UpdateTaskInput = Partial<
  Pick<Task, "title" | "description" | "assigneeAgentId" | "dueDate" | "priority" | "projectId">
>;

export type CreateInputInput = Pick<Input, "workspaceId" | "content"> &
  Partial<Pick<Input, "type" | "title">>;
export type UpdateInputInput = Partial<Pick<Input, "type" | "title" | "content" | "status">>;

export type CreateAgentTaskTemplateInput = Pick<AgentTaskTemplate, "agentId" | "title"> &
  Partial<Pick<AgentTaskTemplate, "description" | "priority">>;

/** all은 하한 없음, week/month와 달리 서버가 시작 시점을 계산하지 않음 */
export type PerformanceReviewPeriod = "week" | "month" | "all";

export type AgentPerformanceMetric = {
  agentId: string;
  agentName: string;
  /** 재시도, 계속하기로 같은 Task에 여러 Run이 쌓여도 한 건으로 세기 위해 run이 아니라 task 기준 distinct 카운트 */
  assignedTaskCount: number;
  /** assignedTaskCount와 동일하게 task 기준 distinct, 재시도 성공을 이중 집계하지 않음 */
  completedTaskCount: number;
  completionRate: number;
  /** task 기준으로 접지 않은 원시 Run 집계, 재시도 횟수 자체를 보여주기 위해 completedTaskCount와 분리 */
  statusCounts: Record<AgentRunStatus, number>;
  /** 시작/종료 시각이 모두 있는 Run이 없으면 0이 아니라 undefined, 소요 시간 데이터가 없다는 뜻 */
  averageDurationMs?: number;
  averageUsage?: RunUsage;
  topSkillIds: string[];
};

export type SkillPerformanceMetric = {
  skillId: string;
  /** run_skills 스냅샷에 저장된 이름, Skill이 그 사이 개명되거나 삭제돼도 당시 이름을 그대로 보여줌 */
  skillName: string;
  usageCount: number;
  topAgentIds: string[];
};

/** 사실 기반으로 근거를 제시할 수 있는 종류만 정의, 판단이 필요한 상은 사용자 피드백 데이터가 쌓인 뒤 추가 */
export type PerformanceAwardKind = "top_agent" | "versatile";

export type PerformanceAward = {
  kind: PerformanceAwardKind;
  agentId: string;
  agentName: string;
  reason: string;
  evidenceTaskIds: string[];
};

export type PerformanceReviewSummary = {
  workspaceId: string;
  period: PerformanceReviewPeriod;
  periodStart?: string;
  periodEnd?: string;
  teamTotals: {
    assignedTaskCount: number;
    completedTaskCount: number;
    completionRate: number;
  };
  agentMetrics: AgentPerformanceMetric[];
  skillMetrics: SkillPerformanceMetric[];
  awards: PerformanceAward[];
  /** Skill 스냅샷 도입 이전에 생성된 Run 수, 현재 Agent 설정으로 소급 추정하지 않고 통계에서 제외한 만큼을 그대로 노출 */
  unattributedRunSkillCount: number;
};
