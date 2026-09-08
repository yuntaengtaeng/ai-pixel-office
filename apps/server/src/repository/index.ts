import type {
  ActivityLog,
  Agent,
  AgentRun,
  AgentTaskTemplate,
  CreateAgentInput,
  CreateAgentTaskTemplateInput,
  CreateSkillInput,
  CreateTaskInput,
  CreateWorkspaceInput,
  PerformanceReviewPeriod,
  PerformanceReviewSummary,
  Project,
  RunProgressEvent,
  Skill,
  TaskOrigin,
  Task,
  TaskResult,
  TaskReview,
  TaskStatus,
  TaskWorkflowStep,
  UpdateAgentInput,
  UpdateSkillInput,
  UpdateTaskInput,
  UpdateWorkspaceInput,
  WorkflowPreset,
  Workspace,
  MessageAttachment,
} from "@ai-pixel-office/domain";
import type { AppDatabase } from "../database.ts";
import { createActivity, listActivities, type CreateActivityInput } from "./activities.ts";
import {
  createAgent,
  createAgentTaskTemplate,
  deleteAgent,
  deleteAgentTaskTemplate,
  getAgent,
  listAgentTaskTemplates,
  listAgents,
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
import { createSkill, deleteSkill, getSkill, listSkills, updateSkill } from "./skills.ts";
import { createTask, deleteTask, getTask, listTasks, transitionTask, updateTask } from "./tasks.ts";
import {
  createWorkflowPreset,
  deleteWorkflowPreset,
  getWorkflowStepByRun,
  listWorkflowPresets,
  listWorkflowSteps,
  resetFailedWorkflowStep,
  setTaskWorkflow,
  updateWorkflowStep,
} from "./workflow.ts";
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
    this.database.prepare(`INSERT INTO task_attachments (id, workspace_id, task_id, run_id, name, media_type, size, source, storage_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.id, input.workspaceId, input.taskId, input.runId ?? null, input.name, input.mediaType, input.size, input.source, input.storagePath, input.createdAt);
    return input;
  }

  getAttachment(id: string): MessageAttachment | undefined {
    const row = this.database.prepare("SELECT * FROM task_attachments WHERE id = ?").get(id) as Record<string, unknown> | undefined;
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
    const row = this.database.prepare("PRAGMA database_list").get() as { file?: string } | undefined;
    if (!row?.file) return [];
    return [row.file, `${row.file}-wal`, `${row.file}-shm`];
  }

  resetApplicationData(): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      // Workspace-owned rows cascade through tasks, runs, attachments, agents and projects.
      this.database.exec("DELETE FROM workspaces; DELETE FROM skills;");
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

  async listSkills(workspaceId?: string): Promise<Skill[]> {
    return listSkills(this.database, workspaceId);
  }

  async getSkill(id: string): Promise<Skill | undefined> {
    return getSkill(this.database, id);
  }

  async createSkill(input: CreateSkillInput): Promise<Skill> {
    return createSkill(this.database, input);
  }

  async updateSkill(id: string, input: UpdateSkillInput): Promise<Skill> {
    return updateSkill(this.database, id, input);
  }

  async deleteSkill(id: string): Promise<void> {
    return deleteSkill(this.database, id);
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

  async deleteTask(id: string): Promise<void> {
    return deleteTask(this.database, id);
  }

  async listWorkflowSteps(taskId: string): Promise<TaskWorkflowStep[]> {
    return listWorkflowSteps(this.database, taskId);
  }

  async listWorkflowPresets(workspaceId: string): Promise<WorkflowPreset[]> {
    return listWorkflowPresets(this.database, workspaceId);
  }

  async createWorkflowPreset(input: {
    workspaceId: string;
    name: string;
    agentIds: string[];
  }): Promise<WorkflowPreset> {
    return createWorkflowPreset(this.database, input, (id) => this.getAgent(id));
  }

  async deleteWorkflowPreset(id: string): Promise<void> {
    return deleteWorkflowPreset(this.database, id);
  }

  async getWorkflowStepByRun(runId: string): Promise<TaskWorkflowStep | undefined> {
    return getWorkflowStepByRun(this.database, runId);
  }

  async setTaskWorkflow(taskId: string, agentIds: string[]): Promise<TaskWorkflowStep[]> {
    return setTaskWorkflow(this.database, taskId, agentIds, (id) => this.getAgent(id));
  }

  async updateWorkflowStep(
    id: string,
    input: Partial<Pick<TaskWorkflowStep, "status" | "runId" | "result">>,
  ): Promise<TaskWorkflowStep> {
    return updateWorkflowStep(this.database, id, input);
  }

  async resetFailedWorkflowStep(taskId: string): Promise<TaskWorkflowStep | undefined> {
    return resetFailedWorkflowStep(this.database, taskId);
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
    return recoverInterruptedRuns(this.database);
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
