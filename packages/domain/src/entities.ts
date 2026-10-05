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
  /** 설정된 경우 대화 시작 시 코워커 선택을 건너뛰고 바로 이 Agent와 시작 */
  defaultAgentId?: string;
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
  /** 동료들이 이 프로젝트에서 알아야 할 사람의 맥락 */
  memo?: string;
  /** 바뀐 뒤 실행해 결과를 검증 사실로 남길 명령 */
  verificationCommands: string[];
  /** 작업 공간을 처음 쓰기 전에 실행할 준비 명령 (예: pnpm install) */
  setupCommand?: string;
  /** 프로젝트 폴더에서 작업 공간으로 복사할 무시된 파일 (예: .env.local) */
  copyFiles: string[];
  /** 이 프로젝트에 새 요청을 맡길 때 먼저 골라 둘 동료 */
  defaultAgentId?: string;
  /** 이 프로젝트 화면을 열어 볼 주소 (예: http://localhost:5173) */
  previewUrl?: string;
  /** 이 프로젝트 팀장이 쓸 runtime (없으면 workspace 기본 동료의 runtime) */
  leadRuntime?: AgentModel;
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
  /** bundled Team으로 만든 동료면 "teamId@version" */
  sourceTeam?: string;
  createdAt: string;
  updatedAt: string;
};

/** 스킬 출처 (bundled는 Team과 함께 설치, local은 사용자가 만듦, imported는 밖에서 가져옴) */
export type SkillSource = "bundled" | "local" | "imported";

export type Skill = {
  /** 폴더 이름이자 SKILL.md의 `name` (소문자, 숫자, `-`) */
  id: string;
  /** 사람이 읽는 표시 이름(pixel-office.json의 title, 없으면 id) */
  name: string;
  description: string;
  category: string;
  source: SkillSource;
  version?: string;
  /** bundled Team이 설치한 스킬이면 그 Team id */
  teamId?: string;
  requiredPermissions?: Array<keyof AgentPermissions>;
  /** SKILL.md 외 보조 파일의 상대 경로 */
  files: string[];
  updatedAt: string;
};

export type SkillDetail = Skill & {
  /** frontmatter를 뺀 SKILL.md 본문 */
  body: string;
};

export const TASK_STATUSES = [
  "todo",
  "working",
  "needs_review",
  "needs_input",
  "blocked",
  "done",
  "failed",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskResult = {
  summary: string;
  artifacts?: Array<{ type: string; name: string; path?: string; url?: string }>;
  metadata?: Record<string, unknown>;
};

export type MessageAttachment = {
  id: string;
  workspaceId: string;
  taskId: string;
  runId?: string;
  name: string;
  mediaType: string;
  size: number;
  source: "file" | "clipboard-image";
  storagePath: string;
  createdAt: string;
};

/** office는 칸반/할일 흐름에서, chat은 사이드바 대화 진입점에서 생성됨, 대화 목록 조회 구분에만 사용 */
export type TaskOrigin = "office" | "chat";

export type Task = {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assigneeAgentId?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  projectId?: string;
  workingDirectory?: string;
  result?: TaskResult;
  origin: TaskOrigin;
  /** 끝날 때 내야 하는 결과 형식 (없으면 자유 형식) */
  resultFormat?: ResultFormat;
  /** 프로젝트 파일을 고치는 기안인지 (false면 같은 폴더 자리를 잡지 않음, 기본 true) */
  modifiesFiles?: boolean;
  /** 팀장 계획서에서 만들어진 기안이면 그 계획서 */
  planId?: string;
  /** 이 기안을 시작하기 전에 끝나야 하는 기안 (앞 기안) */
  waitsFor?: string[];
  /** 파일이 바뀌지 않아도 사람이 결과를 확인해야 끝나는지 (내가 보고 넘김) */
  reviewBeforeNext?: boolean;
  /** 순서 대기 중이면 같은 프로젝트 폴더를 먼저 쓰고 있는 기안서 이름 */
  queuedBehind?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
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
  /** 종료된 runtime session을 명시적으로 다시 열어 만든 Run이면 출발 Run을 보존한다. */
  resumedFromRunId?: string;
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

/** 기안서가 끝날 때 내야 하는 결과 형식 */
export const RESULT_FORMATS = ["ux", "ui", "developer"] as const;

export type ResultFormat = (typeof RESULT_FORMATS)[number];

export function isResultFormat(value: unknown): value is ResultFormat {
  return (RESULT_FORMATS as readonly unknown[]).includes(value);
}

export type RunProgressEvent = {
  id: string;
  runId: string;
  type: "started" | "message" | "tool_started" | "tool_completed" | "permission_requested";
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

/** 같은 프로젝트 폴더가 비기를 기다리게 된 기안서 */
export type QueuedRequest = { queued: true; task: Task };

/** 프로젝트 팀장 대화의 한 줄 (사람의 말, 팀장의 답, 맡긴 기안에 대한 보고) */
export type LeadMessage = {
  id: string;
  projectId: string;
  role: "user" | "lead" | "report";
  content: string;
  /** 팀장이 이 답과 함께 올린 계획서 */
  planId?: string;
  status: "pending" | "done" | "failed";
  createdAt: string;
};

export const LEAD_PLAN_STATUSES = ["proposed", "approved", "rejected"] as const;

export type LeadPlanStatus = (typeof LEAD_PLAN_STATUSES)[number];

/** 계획서의 기안 하나 */
export type LeadPlanItem = {
  /** 계획서 안에서 앞 기안을 가리킬 때 쓰는 이름 */
  key: string;
  title: string;
  /** 끝나면 사람이 받을 것 (업무 언어) */
  deliverable: string;
  /** 담당 동료에게 넘길 내용 */
  brief: string;
  agentId: string;
  resultFormat?: ResultFormat;
  modifiesFiles: boolean;
  /** 앞 기안의 key */
  after: string[];
  reviewBeforeNext: boolean;
};

/** 팀장이 올린 계획서 (결재해야 기안서가 만들어짐) */
export type LeadPlan = {
  id: string;
  projectId: string;
  status: LeadPlanStatus;
  title: string;
  /** 왜 이렇게 나눴는지 */
  reason: string;
  items: LeadPlanItem[];
  /** 반려할 때 남긴 의견 */
  feedback?: string;
  createdAt: string;
  decidedAt?: string;
};

export type ActivityType =
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
  | "agent_created"
  | "result_questions_asked"
  | "result_incomplete"
  | "verification_failed"
  | "verification_returned"
  | "task_completed_without_changes"
  | "workspace_conflict"
  | "workspace_realigned"
  | "request_queued";

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
export type UpdateWorkspaceInput = Partial<CreateWorkspaceInput> &
  Partial<Pick<Workspace, "defaultAgentId">>;

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
      | "sourceTeam"
    >
  >;
export type UpdateAgentInput = Partial<Omit<CreateAgentInput, "workspaceId">>;

export type CreateSkillInput = {
  /** 폴더 이름 (없으면 title에서 생성) */
  id?: string;
  /** 사람이 읽는 이름(라이브러리 표시용) */
  title: string;
  description: string;
  category: string;
  /** SKILL.md 본문(Markdown) */
  instructions: string;
  requiredPermissions?: Array<keyof AgentPermissions>;
};

export type CreateTaskInput = Pick<Task, "workspaceId" | "title"> &
  Partial<
    Pick<
      Task,
      | "description"
      | "assigneeAgentId"
      | "dueDate"
      | "priority"
      | "projectId"
      | "origin"
      | "resultFormat"
    >
  >;
export type UpdateTaskInput = Partial<
  Pick<Task, "title" | "description" | "assigneeAgentId" | "dueDate" | "priority" | "projectId">
>;

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
