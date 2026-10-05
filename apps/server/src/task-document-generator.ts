import { randomUUID } from "node:crypto";
import {
  compileAgentInstructions,
  DomainError,
  type AgentRun,
  type RunLimits,
  type RunProgressEvent,
  type Skill,
} from "@ai-pixel-office/domain";
import type { ExecutionScopeResolver } from "./execution-scope.ts";
import type { Repository } from "./repository/index.ts";
import type { RuntimeAdapter } from "./runtime/index.ts";

export type GeneratedTaskDocument = {
  title: string;
  content: string;
  agentId: string;
  runId?: string;
};

type DocumentRepository = Pick<Repository, "getTask" | "listRuns" | "getAgent" | "listRunProgress">;

/** 기안서 실행 기록을 담당 동료가 팀 문서(Markdown)로 정리 */
export class TaskDocumentGenerator {
  private readonly inProgress = new Set<string>();
  private readonly repository: DocumentRepository;
  private readonly runtime: RuntimeAdapter;
  private readonly scopes: ExecutionScopeResolver;
  private readonly requireSkills: (skillIds: string[]) => Skill[];
  private readonly limits: RunLimits;

  constructor(dependencies: {
    repository: DocumentRepository;
    runtime: RuntimeAdapter;
    scopes: ExecutionScopeResolver;
    requireSkills: (skillIds: string[]) => Skill[];
    limits: RunLimits;
  }) {
    this.repository = dependencies.repository;
    this.runtime = dependencies.runtime;
    this.scopes = dependencies.scopes;
    this.requireSkills = dependencies.requireSkills;
    this.limits = dependencies.limits;
  }

  async generate(taskId: string): Promise<GeneratedTaskDocument> {
    if (this.inProgress.has(taskId)) {
      throw new DomainError(
        "DOCUMENT_GENERATION_IN_PROGRESS",
        "이 작업의 문서를 이미 작성하고 있습니다.",
        409,
      );
    }
    this.inProgress.add(taskId);
    try {
      return await this.write(taskId);
    } finally {
      this.inProgress.delete(taskId);
    }
  }

  private async write(taskId: string): Promise<GeneratedTaskDocument> {
    const task = await this.repository.getTask(taskId);
    if (!task) throw new DomainError("NOT_FOUND", `Task not found: ${taskId}`, 404);
    const runs = await this.repository.listRuns(taskId);
    const sourceRun = runs.find((run) => run.status === "completed" && run.result) ?? runs[0];
    const agentId = sourceRun?.agentId ?? task.assigneeAgentId;
    if (!agentId) {
      throw new DomainError("TASK_UNASSIGNED", "문서를 작성할 담당 에이전트가 없습니다.", 409);
    }
    const agent = await this.repository.getAgent(agentId);
    if (!agent) throw new DomainError("NOT_FOUND", `Agent not found: ${agentId}`, 404);
    const records = [];
    for (const run of [...runs].reverse())
      records.push({ run, progress: await this.repository.listRunProgress(run.id, 50) });
    const scope = await this.scopes.resolve(task);
    const result = await this.runtime.run(
      {
        runId: `documentation-${randomUUID()}`,
        runtime: agent.model,
        modelName: sourceRun?.modelName ?? agent.modelName,
        reasoningEffort: sourceRun?.reasoningEffort ?? agent.reasoningEffort,
        prompt: documentationPrompt(
          compileAgentInstructions(agent, this.requireSkills(agent.skillIds), task),
          sessionRecord(records),
        ),
        // 읽기만 하므로 작업 공간이 이미 정리됐어도 프로젝트 폴더에서 실행
        cwd: scope.projectPath ?? scope.workingDirectory,
        writable: false,
        browser: false,
        figma: false,
        conversational: true,
        limits: this.limits,
      },
      { onEvent: () => undefined, onApprovalPending: () => undefined },
    );
    const completion = result.events.findLast((event) => event.type === "completed");
    if (completion?.type !== "completed") {
      const failure = result.events.findLast((event) => event.type === "failed");
      throw new DomainError(
        "DOCUMENT_GENERATION_FAILED",
        failure?.type === "failed" ? failure.error : "에이전트가 문서 초안을 만들지 못했습니다.",
        502,
      );
    }
    return {
      title: `${task.title} 기록`,
      content: stripMarkdownFence(completion.result.summary),
      agentId,
      runId: sourceRun?.id,
    };
  }
}

/** 실행마다 요청, 진행 기록, 결과, 오류를 모은 근거 기록 (최대 80,000자) */
export function sessionRecord(
  records: Array<{ run: AgentRun; progress: RunProgressEvent[] }>,
): string {
  return records
    .map(({ run, progress }) =>
      [
        `## 실행 ${run.id}`,
        run.request ? `요청:\n${run.request}` : "",
        progress.length > 0
          ? `진행 기록:\n${progress.map((event) => `- ${event.message}`).join("\n")}`
          : "",
        run.result?.summary ? `결과:\n${run.result.summary}` : "",
        run.error ? `오류:\n${run.error}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    )
    .join("\n\n")
    .slice(0, 80_000);
}

export function documentationPrompt(instructions: string, source: string): string {
  return `${instructions}

DOCUMENTATION-ONLY FOLLOW-UP
You are the same AI colleague who handled this task. Do not modify files, run tools, or continue the implementation. Turn the grounded session record below into a durable Korean Markdown document for future teammates.

Requirements:
- Return only the Markdown document, without a fenced code block or preamble.
- Synthesize; do not copy the transcript or list every tool event.
- Start with a short "한눈에 보기" summary, then choose only the useful sections from: 배경과 목적, 주요 결정과 근거, 수행 내용, 결과와 산출물, 검증 방법과 결과, 주의사항, 남은 작업.
- Adapt the structure to the work instead of forcing empty sections. Omit a section when the source contains no grounded information for it.
- Never invent decisions, files, results, or remaining work.

SESSION RECORD
${source || "실행 기록이 없습니다. 작업 요청과 현재 결과만 사용하세요."}`;
}

function stripMarkdownFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}
