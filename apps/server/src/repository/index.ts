import type {
  ActivityLog,
  Agent,
  AgentRun,
  AgentTaskTemplate,
  CreateAgentInput,
  CreateAgentTaskTemplateInput,
  CreateInputInput,
  CreateSkillInput,
  CreateTaskInput,
  CreateWorkspaceInput,
  Input,
  InputStatus,
  Project,
  RunProgressEvent,
  Skill,
  Task,
  TaskResult,
  TaskReview,
  TaskStatus,
  TaskWorkflowStep,
  UpdateAgentInput,
  UpdateInputInput,
  UpdateSkillInput,
  UpdateTaskInput,
  UpdateWorkspaceInput,
  WorkflowPreset,
  Workspace,
} from "@ai-pixel-office/domain";
import type { AppDatabase } from "../database.ts";
import {
  createActivity,
  listActivities,
  type CreateActivityInput,
} from "./activities.ts";
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
  convertInput,
  createInput,
  deleteInput,
  getInput,
  listInputs,
  updateInput,
} from "./inputs.ts";
import {
  createProjectDirectory,
  deleteProjectDirectory,
  getProject,
  listProjectDirectories,
  updateProject,
  type ProjectLookup,
} from "./projects.ts";
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
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  transitionTask,
  updateTask,
} from "./tasks.ts";
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

  async listTasks(workspaceId?: string, status?: TaskStatus): Promise<Task[]> {
    return listTasks(this.database, workspaceId, status);
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

  async listInputs(workspaceId: string, status?: InputStatus): Promise<Input[]> {
    return listInputs(this.database, workspaceId, status);
  }

  async getInput(id: string): Promise<Input | undefined> {
    return getInput(this.database, id);
  }

  async createInput(input: CreateInputInput): Promise<Input> {
    return createInput(this.database, input);
  }

  async updateInput(id: string, input: UpdateInputInput): Promise<Input> {
    return updateInput(this.database, id, input);
  }

  async deleteInput(id: string): Promise<void> {
    return deleteInput(this.database, id);
  }

  async convertInput(
    id: string,
    taskInput: Partial<
      Pick<CreateTaskInput, "title" | "description" | "assigneeAgentId" | "priority" | "projectId">
    >,
  ): Promise<{ input: Input; task: Task }> {
    return convertInput(this.database, id, taskInput, this.scopeLookups());
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

  async createActivity(input: CreateActivityInput): Promise<ActivityLog> {
    return createActivity(this.database, input);
  }

  async listActivities(workspaceId: string, limit = 100): Promise<ActivityLog[]> {
    return listActivities(this.database, workspaceId, limit);
  }
}
