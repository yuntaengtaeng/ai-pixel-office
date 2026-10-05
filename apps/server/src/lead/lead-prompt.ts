import type { Agent, Project, Task } from "@ai-pixel-office/domain";

export type LeadContext = {
  project: Pick<Project, "name" | "path" | "memo" | "verificationCommands">;
  agents: Agent[];
  /** 이 프로젝트의 끝나지 않은 기안서 */
  openTasks: Task[];
  /** 설치한 팀이 보통 일하는 순서 ("화면 개선 요청: UX Designer → UI Designer → Developer") */
  workGuides: string[];
};

const TASK_STATE_LABEL: Record<Task["status"], string> = {
  todo: "시작 전",
  working: "진행 중",
  needs_review: "결재 대기",
  needs_input: "답변 대기",
  blocked: "멈춤",
  done: "완료",
  failed: "실패",
};

function colleaguesSection(agents: Agent[]): string {
  return agents
    .map(
      (agent) =>
        `- id: ${agent.id} | ${agent.name} | ${agent.role} | runtime: ${agent.model} | can edit files: ${
          agent.permissions.fileWrite === true ? "yes" : "no"
        }${agent.skillIds.length ? ` | skills: ${agent.skillIds.join(", ")}` : ""}`,
    )
    .join("\n");
}

function openTasksSection(tasks: Task[], agents: Agent[]): string {
  if (tasks.length === 0) return "(none)";
  return tasks
    .map((task) => {
      const assignee =
        agents.find((agent) => agent.id === task.assigneeAgentId)?.name ?? "unassigned";
      return `- ${task.title} | ${assignee} | ${task.queuedBehind ? "순서 대기" : TASK_STATE_LABEL[task.status]}`;
    })
    .join("\n");
}

/** 팀장이 읽는 지금 상황 (동료, 진행 중인 기안서, 팀 안내) */
export function leadContextSection(context: LeadContext): string {
  return [
    `PROJECT: ${context.project.name}${context.project.path ? ` (${context.project.path})` : ""}`,
    context.project.memo?.trim() ? `PROJECT NOTES\n${context.project.memo.trim()}` : "",
    context.project.verificationCommands.length
      ? `PROJECT CHECKS: ${context.project.verificationCommands.join(", ")}`
      : "",
    `COLLEAGUES\n${colleaguesSection(context.agents)}`,
    `OPEN REQUESTS\n${openTasksSection(context.openTasks, context.agents)}`,
    context.workGuides.length
      ? `USUAL TEAM ORDERS\n${context.workGuides.map((guide) => `- ${guide}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** 팀장의 역할과 계획서 제출 방법 */
export function leadInstructions(): string {
  return [
    "You are the project lead in Pixel Office. You plan and delegate; you never change files or do the work yourself.",
    "Reply in Korean, in plain language a non-developer understands. You may read the project folder to understand it.",
    "When the user asks for work, propose a plan: split it into requests, each done by ONE colleague from COLLEAGUES.",
    "- Split only when different colleagues are needed or the user should check a result before the next step. Prefer fewer requests.",
    "- deliverable: what the user receives when it is done, in plain words (not the steps).",
    "- brief: everything that colleague needs to know to do it alone.",
    "- modifiesFiles: true only when the request changes project files; its colleague must be able to edit files.",
    "- after: keys of earlier requests that must finish first. reviewBeforeNext: true when the user should check this result before later requests start (for example a spec before building it).",
    "- resultFormat: ux, ui or developer when the colleague's role matches, otherwise leave it out.",
    'Submit the plan once: if a report_result tool is available, call it with { "result": { "plan": PLAN } }. Otherwise end your answer with:',
    "```pixel-office-result",
    '{ "plan": PLAN }',
    "```",
    'PLAN = { "title": string, "reason": "why it is split this way, one or two sentences", "items": [ { "key", "title", "deliverable", "brief", "assignee": colleague id, "resultFormat"?, "modifiesFiles", "after": [keys], "reviewBeforeNext" } ] }',
    "If the user is only asking a question or chatting, answer without a plan. If no colleague fits, say what kind of colleague is missing instead of forcing a plan.",
  ].join("\n");
}

/** 팀장에게 보낼 한 턴 (처음이면 역할까지, 이어가는 세션이면 바뀐 상황과 말만) */
export function leadTurnPrompt(input: {
  context: LeadContext;
  message: string;
  continuing: boolean;
}): string {
  const situation = leadContextSection(input.context);
  return input.continuing
    ? `UPDATED SITUATION\n${situation}\n\nUSER\n${input.message}`
    : `${leadInstructions()}\n\n${situation}\n\nUSER\n${input.message}`;
}
