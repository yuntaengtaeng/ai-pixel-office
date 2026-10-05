import type {
  ActivityLog,
  Agent,
  AgentModel,
  LeadMessage,
  LeadPlan,
  AgentRun,
  AgentTaskTemplate,
  CreateAgentInput,
  CreateAgentTaskTemplateInput,
  CreateTaskInput,
  CreateWorkspaceInput,
  PerformanceReviewPeriod,
  PerformanceReviewSummary,
  Project,
  RunProgressEvent,
  TaskOrigin,
  Task,
  TaskResult,
  TaskReview,
  TaskStatus,
  UpdateAgentInput,
  UpdateTaskInput,
  UpdateWorkspaceInput,
  Workspace,
  MessageAttachment,
} from "@ai-pixel-office/domain";
import type { AppDatabase } from "../database.ts";
import {
  createActivity,
  listActivities,
  listTaskActivities,
  type CreateActivityInput,
} from "./activities.ts";
import {
  countAgentsUsingSkill,
  createAgent,
  createAgentTaskTemplate,
  deleteAgent,
  deleteAgentTaskTemplate,
  getAgent,
  listAgentTaskTemplates,
  listAgents,
  listAgentsBySourceTeam,
  updateAgent,
  type AgentLookup,
} from "./agents.ts";
import {
  createProjectDirectory,
  deleteProjectDirectory,
  getProject,
  listProjectDirectories,
  updateProject,
  type ProjectLookup,
} from "./projects.ts";
import { getPerformanceSummary } from "./performance.ts";
import {
  evaluatePetUnlocks,
  readPetUnlockProgress,
  type PetUnlockProgress,
} from "./pet-unlocks.ts";
import { createReview, listReviews } from "./reviews.ts";
import {
  getRequestWorkspaceBinding,
  saveRequestWorkspaceBinding,
  type RequestWorkspaceBinding,
} from "./request-workspaces.ts";
import {
  firstRun,
  createRun,
  createRunProgress,
  getRun,
  latestRun,
  listRunProgress,
  listRuns,
  recoverInterruptedRuns,
  reserveRun,
  updateRun,
  type RunReservation,
} from "./runs.ts";
import {
  createTask,
  deleteTask,
  getTask,
  listPlanTasks,
  listQueuedTasks,
  listTasks,
  queueTask,
  transitionTask,
  updateTask,
} from "./tasks.ts";
import {
  approveLeadPlan,
  createLeadMessage,
  createLeadPlan,
  failPendingLeadMessages,
  finishLeadMessage,
  getLeadPlan,
  hasPendingLeadMessage,
  latestLeadThread,
  listLeadMessages,
  listLeadPlans,
  rejectLeadPlan,
} from "./leads.ts";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  updateWorkspace,
} from "./workspaces.ts";

export type { AppDatabase };

export class Repository {
  private readonly database: AppDatabase;

  constructor(database: AppDatabase) {
    this.database = database;
  }

  close(): void {
    this.database.close();
  }

  createAttachment(input: MessageAttachment): MessageAttachment {
    this.database
      .prepare(
        `INSERT INTO task_attachments (id, workspace_id, task_id, run_id, name, media_type, size, source, storage_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.workspaceId,
        input.taskId,
        input.runId ?? null,
        input.name,
        input.mediaType,
        input.size,
        input.source,
        input.storagePath,
        input.createdAt,
      );
    return input;
  }

  getAttachment(id: string): MessageAttachment | undefined {
    const row = this.database.prepare("SELECT * FROM task_attachments WHERE id = ?").get(id) as
      Record<string, unknown> | undefined;
    return row ? attachmentFromRow(row) : undefined;
  }

  deletePendingAttachment(id: string): MessageAttachment | undefined {
    const attachment = this.getAttachment(id);
    if (!attachment || attachment.runId) return undefined;
    this.database.prepare("DELETE FROM task_attachments WHERE id = ? AND run_id IS NULL").run(id);
    return attachment;
  }

  deletePendingAttachmentsBefore(createdBefore: string): MessageAttachment[] {
    const rows = this.database
      .prepare(
        "SELECT * FROM task_attachments WHERE run_id IS NULL AND created_at < ? ORDER BY created_at",
      )
      .all(createdBefore) as Record<string, unknown>[];
    const attachments = rows.map(attachmentFromRow);
    this.database
      .prepare("DELETE FROM task_attachments WHERE run_id IS NULL AND created_at < ?")
      .run(createdBefore);
    return attachments;
  }

  deletePendingAttachmentsByWorkspace(workspaceId: string): MessageAttachment[] {
    const rows = this.database
      .prepare("SELECT * FROM task_attachments WHERE workspace_id = ? AND run_id IS NULL")
      .all(workspaceId) as Record<string, unknown>[];
    this.database
      .prepare("DELETE FROM task_attachments WHERE workspace_id = ? AND run_id IS NULL")
      .run(workspaceId);
    return rows.map(attachmentFromRow);
  }

  databaseFiles(): string[] {
    const row = this.database.prepare("PRAGMA database_list").get() as
      { file?: string } | undefined;
    if (!row?.file) return [];
    return [row.file, `${row.file}-wal`, `${row.file}-shm`];
  }

  resetApplicationData(): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      // Workspace-owned rows cascade through tasks, runs, attachments, agents and projects.
      this.database.exec("DELETE FROM workspaces;");
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    // Keep the migrated schema open for the running server while returning unused pages to disk.
    this.database.exec("VACUUM");
  }

  /** 클라이언트가 보낸 ID 목록을 신뢰하지 않고, 실제 존재하는 첨부만 그대로 돌려준다 — 호출부가 taskId 소유권을 다시 확인한다. */
  listAttachmentsByIds(ids: string[]): MessageAttachment[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.database
      .prepare(`SELECT * FROM task_attachments WHERE id IN (${placeholders})`)
      .all(...ids) as Record<string, unknown>[];
    return rows.map(attachmentFromRow);
  }

  listAttachmentsByTask(taskId: string): MessageAttachment[] {
    const rows = this.database
      .prepare("SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at")
      .all(taskId) as Record<string, unknown>[];
    return rows.map(attachmentFromRow);
  }

  listAttachmentsByWorkspace(workspaceId: string): MessageAttachment[] {
    const rows = this.database
      .prepare("SELECT * FROM task_attachments WHERE workspace_id = ? ORDER BY created_at")
      .all(workspaceId) as Record<string, unknown>[];
    return rows.map(attachmentFromRow);
  }

  // getAgent/getProject 위임 메서드를 통해 조회하도록 넘긴다 — 테스트가 인스턴스의
  // getAgent/getProject를 오버라이드해 동시성 시나리오를 재현할 때도 그 오버라이드를 그대로 탄다.
  private scopeLookups(): { lookupAgent: AgentLookup; lookupProject: ProjectLookup } {
    return {
      lookupAgent: (id) => this.getAgent(id),
      lookupProject: (id) => this.getProject(id),
    };
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return listWorkspaces(this.database);
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    return getWorkspace(this.database, id);
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    return createWorkspace(this.database, input);
  }

  async updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {
    return updateWorkspace(this.database, id, input);
  }

  async deleteWorkspace(id: string): Promise<void> {
    return deleteWorkspace(this.database, id);
  }

  async listProjectDirectories(workspaceId: string): Promise<Project[]> {
    return listProjectDirectories(this.database, workspaceId);
  }

  async getProject(id: string): Promise<Project | undefined> {
    return getProject(this.database, id);
  }

  async createProjectDirectory(
    input: Pick<Project, "workspaceId" | "name"> &
      Partial<Pick<Project, "description" | "status" | "figmaUrl" | "path">>,
  ): Promise<Project> {
    return createProjectDirectory(this.database, input);
  }

  async updateProject(
    id: string,
    input: Partial<Pick<Project, "name" | "description" | "status" | "figmaUrl" | "path">>,
  ): Promise<Project> {
    return updateProject(this.database, id, input);
  }

  async deleteProjectDirectory(id: string): Promise<void> {
    return deleteProjectDirectory(this.database, id);
  }

  countAgentsUsingSkill(skillId: string): number {
    return countAgentsUsingSkill(this.database, skillId);
  }

  async listAgentsBySourceTeam(workspaceId: string, sourceTeamPrefix: string): Promise<Agent[]> {
    return listAgentsBySourceTeam(this.database, workspaceId, sourceTeamPrefix);
  }

  getAppMeta(key: string): string | undefined {
    const row = this.database.prepare("SELECT value FROM app_meta WHERE key = ?").get(key) as
      { value: string } | undefined;
    return row?.value;
  }

  setAppMeta(key: string, value: string): void {
    this.database
      .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)")
      .run(key, value);
  }

  async listAgents(workspaceId?: string): Promise<Agent[]> {
    return listAgents(this.database, workspaceId);
  }

  async getPetUnlockProgress(workspaceId: string): Promise<PetUnlockProgress[]> {
    return readPetUnlockProgress(this.database, workspaceId);
  }

  async evaluatePetUnlocks(workspaceId: string): Promise<PetUnlockProgress[]> {
    return evaluatePetUnlocks(this.database, workspaceId);
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return getAgent(this.database, id);
  }

  async createAgent(input: CreateAgentInput): Promise<Agent> {
    return createAgent(this.database, input);
  }

  async updateAgent(id: string, input: UpdateAgentInput): Promise<Agent> {
    return updateAgent(this.database, id, input);
  }

  async deleteAgent(id: string): Promise<void> {
    return deleteAgent(this.database, id);
  }

  async listAgentTaskTemplates(agentId: string): Promise<AgentTaskTemplate[]> {
    return listAgentTaskTemplates(this.database, agentId);
  }

  async createAgentTaskTemplate(input: CreateAgentTaskTemplateInput): Promise<AgentTaskTemplate> {
    return createAgentTaskTemplate(this.database, input);
  }

  async deleteAgentTaskTemplate(agentId: string, id: string): Promise<void> {
    return deleteAgentTaskTemplate(this.database, agentId, id);
  }

  async listTasks(workspaceId?: string, status?: TaskStatus, origin?: TaskOrigin): Promise<Task[]> {
    return listTasks(this.database, workspaceId, status, origin);
  }

  async getTask(id: string): Promise<Task | undefined> {
    return getTask(this.database, id);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return createTask(this.database, input, this.scopeLookups());
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    return updateTask(this.database, id, input, this.scopeLookups());
  }

  async transitionTask(id: string, status: TaskStatus, result?: TaskResult): Promise<Task> {
    return transitionTask(this.database, id, status, result);
  }

  async queueTask(
    id: string,
    holderTitle: string,
    metadata: Record<string, unknown>,
  ): Promise<{ task: Task; activity: ActivityLog }> {
    return queueTask(this.database, id, holderTitle, metadata);
  }

  async listQueuedTasks(projectId: string): Promise<Task[]> {
    return listQueuedTasks(this.database, projectId);
  }

  async deleteTask(id: string): Promise<void> {
    return deleteTask(this.database, id);
  }

  async createRun(
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
      | "resumedFromRunId"
      | "request"
      | "scopeType"
      | "scopeProjectId"
      | "workingDirectory"
    >,
  ): Promise<AgentRun> {
    return createRun(this.database, input);
  }

  async reserveRun(
    input: Parameters<Repository["createRun"]>[0],
    reservation: RunReservation,
  ): Promise<{ run: AgentRun; task: Task; activities: ActivityLog[]; review?: TaskReview }> {
    return reserveRun(this.database, input, reservation);
  }

  async getRun(id: string): Promise<AgentRun | undefined> {
    return getRun(this.database, id);
  }

  async listRuns(taskId?: string): Promise<AgentRun[]> {
    return listRuns(this.database, taskId);
  }

  async createRunProgress(
    input: Omit<RunProgressEvent, "id" | "createdAt">,
  ): Promise<RunProgressEvent> {
    return createRunProgress(this.database, input);
  }

  async listRunProgress(runId: string, limit = 100): Promise<RunProgressEvent[]> {
    return listRunProgress(this.database, runId, limit);
  }

  async recoverInterruptedRuns(): Promise<number> {
    failPendingLeadMessages(this.database);
    return recoverInterruptedRuns(this.database);
  }

  async listPlanTasks(planId: string): Promise<Task[]> {
    return listPlanTasks(this.database, planId);
  }

  listLeadMessages(projectId: string): LeadMessage[] {
    return listLeadMessages(this.database, projectId);
  }

  createLeadMessage(input: Parameters<typeof createLeadMessage>[1]): LeadMessage {
    return createLeadMessage(this.database, input);
  }

  finishLeadMessage(id: string, input: Parameters<typeof finishLeadMessage>[2]): LeadMessage {
    return finishLeadMessage(this.database, id, input);
  }

  latestLeadThread(projectId: string, runtime: AgentModel): string | undefined {
    return latestLeadThread(this.database, projectId, runtime);
  }

  hasPendingLeadMessage(projectId: string): boolean {
    return hasPendingLeadMessage(this.database, projectId);
  }

  createLeadPlan(input: Parameters<typeof createLeadPlan>[1]): LeadPlan {
    return createLeadPlan(this.database, input);
  }

  getLeadPlan(id: string): LeadPlan | undefined {
    return getLeadPlan(this.database, id);
  }

  listLeadPlans(projectId: string): LeadPlan[] {
    return listLeadPlans(this.database, projectId);
  }

  rejectLeadPlan(id: string, feedback: string): LeadPlan {
    return rejectLeadPlan(this.database, id, feedback);
  }

  approveLeadPlan(id: string): { plan: LeadPlan; tasks: Task[] } {
    return approveLeadPlan(this.database, id);
  }

  async latestRun(taskId: string): Promise<AgentRun | undefined> {
    return latestRun(this.database, taskId);
  }

  async updateRun(
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
  ): Promise<AgentRun> {
    return updateRun(this.database, id, patch);
  }

  async createReview(input: Omit<TaskReview, "id" | "createdAt">): Promise<TaskReview> {
    return createReview(this.database, input);
  }

  async listReviews(taskId: string): Promise<TaskReview[]> {
    return listReviews(this.database, taskId);
  }

  async getPerformanceSummary(
    workspaceId: string,
    period: PerformanceReviewPeriod,
  ): Promise<PerformanceReviewSummary> {
    return getPerformanceSummary(this.database, workspaceId, period);
  }

  async createActivity(input: CreateActivityInput): Promise<ActivityLog> {
    return createActivity(this.database, input);
  }

  async firstRun(taskId: string): Promise<AgentRun | undefined> {
    return firstRun(this.database, taskId);
  }

  getRequestWorkspaceBinding(taskId: string): RequestWorkspaceBinding | undefined {
    return getRequestWorkspaceBinding(this.database, taskId);
  }

  saveRequestWorkspaceBinding(binding: RequestWorkspaceBinding): void {
    saveRequestWorkspaceBinding(this.database, binding);
  }

  listTaskActivities(taskId: string, type: ActivityLog["type"]): ActivityLog[] {
    return listTaskActivities(this.database, taskId, type);
  }

  async listActivities(workspaceId: string, limit = 100): Promise<ActivityLog[]> {
    return listActivities(this.database, workspaceId, limit);
  }
}

function attachmentFromRow(row: Record<string, unknown>): MessageAttachment {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    taskId: String(row.task_id),
    runId: row.run_id ? String(row.run_id) : undefined,
    name: String(row.name),
    mediaType: String(row.media_type),
    size: Number(row.size),
    source: row.source as MessageAttachment["source"],
    storagePath: String(row.storage_path),
    createdAt: String(row.created_at),
  };
}
