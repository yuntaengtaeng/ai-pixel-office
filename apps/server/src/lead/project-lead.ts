import {
  DomainError,
  type Agent,
  type AgentModel,
  type LeadMessage,
  type LeadPlan,
  type Project,
  type RunLimits,
} from "@ai-pixel-office/domain";
import type { EventBus } from "../events.ts";
import type { Repository } from "../repository/index.ts";
import { collectRunFacts } from "../request-engine/run-facts.ts";
import type { RuntimeAdapter } from "../runtime/index.ts";
import { leadReplyText, readLeadPlan } from "./lead-plan.ts";
import { leadTurnPrompt } from "./lead-prompt.ts";

const STOPPED_REPLY = "답을 멈췄어요. 다시 말해 주세요.";

export type LeadConversation = {
  messages: LeadMessage[];
  plans: LeadPlan[];
  /** 팀장이 지금 답을 쓰는 중인지 */
  replying: boolean;
  runtime: AgentModel;
};

type LeadRepository = Pick<
  Repository,
  | "getProject"
  | "getWorkspace"
  | "getAgent"
  | "listAgents"
  | "listTasks"
  | "listLeadMessages"
  | "createLeadMessage"
  | "finishLeadMessage"
  | "latestLeadThread"
  | "hasPendingLeadMessage"
  | "createLeadPlan"
  | "getLeadPlan"
  | "listLeadPlans"
  | "rejectLeadPlan"
  | "approveLeadPlan"
>;

/**
 * 프로젝트 팀장 (원하는 결과를 듣고 계획서를 올리며, 결재되면 기안서를 만들어 맡김)
 * 팀장은 프로젝트 폴더를 읽기만 하고, 도구 권한 요청은 모두 거절해 승인을 기다리며 멈추지 않음
 */
export class ProjectLead {
  private readonly repository: LeadRepository;
  private readonly runtime: RuntimeAdapter;
  private readonly events: EventBus;
  private readonly limits: RunLimits;
  private readonly startPlan: (planId: string) => Promise<void>;
  private readonly workGuides: (agents: Agent[]) => string[];
  /** 답을 쓰는 중인 팀장 run (프로젝트 id → run id) */
  private readonly replyRuns = new Map<string, string>();
  /** 사람이 멈춘 팀장 run */
  private readonly stoppedRuns = new Set<string>();

  constructor(dependencies: {
    repository: LeadRepository;
    runtime: RuntimeAdapter;
    events: EventBus;
    limits: RunLimits;
    /** 결재한 계획서에서 시작할 수 있는 기안서를 시작 */
    startPlan: (planId: string) => Promise<void>;
    /** 설치한 팀이 보통 일하는 순서 안내 */
    workGuides: (agents: Agent[]) => string[];
  }) {
    this.repository = dependencies.repository;
    this.runtime = dependencies.runtime;
    this.events = dependencies.events;
    this.limits = dependencies.limits;
    this.startPlan = dependencies.startPlan;
    this.workGuides = dependencies.workGuides;
  }

  async conversation(projectId: string): Promise<LeadConversation> {
    const project = await this.requireProject(projectId);
    return {
      messages: this.repository.listLeadMessages(projectId),
      plans: this.repository.listLeadPlans(projectId),
      replying: this.repository.hasPendingLeadMessage(projectId),
      runtime: await this.runtimeOf(project),
    };
  }

  /** 팀장에게 말하기 (팀장의 답은 바로 돌아오지 않고 쓰는 중으로 남았다가 채워짐) */
  async send(projectId: string, message: string): Promise<LeadMessage> {
    const text = message.trim();
    if (!text) throw new DomainError("INVALID_MESSAGE", "팀장에게 할 말을 적어 주세요");
    const project = await this.requireProject(projectId);
    if (!project.path) {
      throw new DomainError(
        "PROJECT_FOLDER_REQUIRED",
        "작업 폴더를 연결한 프로젝트에만 팀장이 있어요",
        409,
      );
    }
    if (this.repository.hasPendingLeadMessage(projectId)) {
      throw new DomainError(
        "LEAD_REPLYING",
        "팀장이 답을 쓰고 있어요. 답이 오면 이어서 말해 주세요",
        409,
      );
    }
    const runtime = await this.runtimeOf(project);
    this.repository.createLeadMessage({ projectId, role: "user", content: text, status: "done" });
    const reply = this.repository.createLeadMessage({
      projectId,
      role: "lead",
      content: "",
      status: "pending",
      runtime,
    });
    this.publish(project);
    queueMicrotask(() => {
      this.writeReply(project, reply, text, runtime).catch((error: unknown) => {
        console.error(`Lead reply failed in project ${projectId}`, error);
      });
    });
    return reply;
  }

  /** 팀장이 쓰던 답을 멈춤 (서버가 다시 시작돼 실행이 없으면 쓰는 중 표시만 정리) */
  async stopReply(projectId: string): Promise<void> {
    const project = await this.requireProject(projectId);
    const runId = this.replyRuns.get(projectId);
    if (runId) {
      this.stoppedRuns.add(runId);
      this.runtime.cancel(runId);
      return;
    }
    const pending = this.repository
      .listLeadMessages(projectId)
      .find((message) => message.status === "pending");
    if (pending) {
      this.repository.finishLeadMessage(pending.id, { status: "failed", content: STOPPED_REPLY });
      this.publish(project);
    }
  }

  /** 계획서 결재: 기안서를 만들고 앞 기안이 없는 기안서부터 시작 */
  async approvePlan(planId: string): Promise<LeadPlan> {
    const { plan, tasks } = this.repository.approveLeadPlan(planId);
    this.repository.createLeadMessage({
      projectId: plan.projectId,
      role: "report",
      content: `계획서를 결재했어요. 기안 ${tasks.length}개를 만들었어요.`,
      status: "done",
    });
    await this.startPlan(plan.id);
    this.publish(await this.requireProject(plan.projectId));
    return plan;
  }

  /** 계획서 반려: 의견을 팀장에게 전해 새 계획서를 부탁 */
  async rejectPlan(planId: string, feedback: string): Promise<LeadPlan> {
    const text = feedback.trim();
    if (!text) throw new DomainError("INVALID_FEEDBACK", "반려 의견을 적어 주세요");
    const plan = this.repository.rejectLeadPlan(planId, text);
    await this.send(plan.projectId, `계획서를 반려했어요. ${text}`);
    return plan;
  }

  /** 계획서를 진행하지 않음 (팀장에게 새 계획서를 부탁하지 않음) */
  async discardPlan(planId: string): Promise<LeadPlan> {
    const plan = this.repository.rejectLeadPlan(planId, "");
    this.repository.createLeadMessage({
      projectId: plan.projectId,
      role: "report",
      content: `'${plan.title}' 계획서는 진행하지 않기로 했어요.`,
      status: "done",
    });
    this.publish(await this.requireProject(plan.projectId));
    return plan;
  }

  private async writeReply(
    project: Project,
    reply: LeadMessage,
    message: string,
    runtime: AgentModel,
  ): Promise<void> {
    const agents = await this.repository.listAgents(project.workspaceId);
    const openTasks = (await this.repository.listTasks(project.workspaceId)).filter(
      (task) => task.projectId === project.id && task.status !== "done",
    );
    const thread = this.repository.latestLeadThread(project.id, runtime);
    const runId = `lead-${reply.id}`;
    this.replyRuns.set(project.id, runId);
    try {
      const result = await this.runtime.run(
        {
          runId,
          runtime,
          prompt: leadTurnPrompt({
            context: { project, agents, openTasks, workGuides: this.workGuides(agents) },
            message,
            continuing: Boolean(thread),
          }),
          cwd: project.path ?? "",
          resumeThreadId: thread,
          writable: false,
          browser: false,
          figma: false,
          conversational: false,
          limits: this.limits,
          resultReporting: true,
        },
        {
          onEvent: (event) => {
            if (event.type === "permission_requested")
              this.runtime.resolveApproval(runId, String(event.requestId), "decline");
          },
          onApprovalPending: () => undefined,
        },
      );
      const completion = result.events.findLast((event) => event.type === "completed");
      if (completion?.type !== "completed") {
        const failure = result.events.findLast((event) => event.type === "failed");
        throw new Error(failure?.type === "failed" ? failure.error : "팀장이 답을 끝내지 못했어요");
      }
      const answer = completion.result.summary;
      const reading = readLeadPlan(collectRunFacts(result.events, answer).reportedResult, agents);
      const plan =
        reading.kind === "plan"
          ? this.repository.createLeadPlan({ projectId: project.id, ...reading.plan })
          : undefined;
      const replyText = leadReplyText(answer) || (plan ? "계획서를 올렸어요." : "");
      this.repository.finishLeadMessage(reply.id, {
        status: "done",
        content:
          reading.kind === "invalid"
            ? `${replyText}\n\n계획서 형식이 맞지 않아 올리지 못했어요: ${reading.problems.join(", ")}`
            : replyText,
        ...(plan ? { planId: plan.id } : {}),
        threadId: result.threadId,
      });
    } catch (error) {
      this.repository.finishLeadMessage(reply.id, {
        status: "failed",
        content: this.stoppedRuns.has(runId)
          ? STOPPED_REPLY
          : error instanceof Error
            ? error.message
            : String(error),
      });
    } finally {
      this.replyRuns.delete(project.id);
      this.stoppedRuns.delete(runId);
    }
    this.publish(project);
  }

  /** 팀장이 쓸 runtime (프로젝트 설정, workspace 기본 동료, 첫 동료 순) */
  private async runtimeOf(project: Project): Promise<AgentModel> {
    if (project.leadRuntime) return project.leadRuntime;
    const workspace = await this.repository.getWorkspace(project.workspaceId);
    const defaultAgent = workspace?.defaultAgentId
      ? await this.repository.getAgent(workspace.defaultAgentId)
      : undefined;
    const [firstAgent] = await this.repository.listAgents(project.workspaceId);
    return defaultAgent?.model ?? firstAgent?.model ?? "claude";
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.repository.getProject(projectId);
    if (!project) throw new DomainError("NOT_FOUND", `Project not found: ${projectId}`, 404);
    return project;
  }

  private publish(project: Project): void {
    this.events.publish({
      type: "lead.updated",
      workspaceId: project.workspaceId,
      data: { projectId: project.id },
    });
  }
}
