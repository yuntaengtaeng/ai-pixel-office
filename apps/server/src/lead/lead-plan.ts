import { isResultFormat, type Agent, type LeadPlanItem } from "@ai-pixel-office/domain";

export type ProposedPlan = { title: string; reason: string; items: LeadPlanItem[] };

export type PlanReading =
  { kind: "none" } | { kind: "plan"; plan: ProposedPlan } | { kind: "invalid"; problems: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 팀장이 보고한 결과에서 계획서 읽기 (계획서가 없으면 none, 형식이 틀리면 고칠 점)
 * 담당은 동료 id 또는 이름, 앞 기안은 계획서 안에서 먼저 나온 기안의 key만 허용
 */
export function readLeadPlan(reported: unknown, agents: Agent[]): PlanReading {
  if (!isRecord(reported) || !isRecord(reported.plan)) return { kind: "none" };
  const raw = reported.plan;
  const problems: string[] = [];
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  if (rawItems.length === 0) problems.push("기안이 하나도 없어요");
  const seenKeys = new Set<string>();
  const items: LeadPlanItem[] = [];
  rawItems.forEach((rawItem, index) => {
    const label = `${index + 1}번 기안`;
    if (!isRecord(rawItem)) {
      problems.push(`${label}의 형식이 맞지 않아요`);
      return;
    }
    const key = text(rawItem.key) || `item-${index + 1}`;
    const title = text(rawItem.title);
    const deliverable = text(rawItem.deliverable);
    const assignee = text(rawItem.assignee);
    const agent = agents.find(
      (candidate) => candidate.id === assignee || candidate.name === assignee,
    );
    const after = Array.isArray(rawItem.after) ? rawItem.after.map(text).filter(Boolean) : [];
    if (seenKeys.has(key)) problems.push(`${label}의 key "${key}"가 겹쳐요`);
    if (!title) problems.push(`${label}에 제목이 없어요`);
    if (!deliverable) problems.push(`${label}에 끝나면 받을 것이 없어요`);
    if (!agent) problems.push(`${label}의 담당 "${assignee}"를 찾을 수 없어요`);
    for (const previous of after) {
      if (!seenKeys.has(previous))
        problems.push(`${label}의 앞 기안 "${previous}"는 이 기안보다 먼저 나와야 해요`);
    }
    if (rawItem.resultFormat !== undefined && !isResultFormat(rawItem.resultFormat))
      problems.push(`${label}의 결과 형식은 ux, ui, developer 중 하나여야 해요`);
    seenKeys.add(key);
    if (!agent) return;
    items.push({
      key,
      title,
      deliverable,
      brief: text(rawItem.brief) || title,
      agentId: agent.id,
      ...(isResultFormat(rawItem.resultFormat) ? { resultFormat: rawItem.resultFormat } : {}),
      modifiesFiles: rawItem.modifiesFiles === true,
      after,
      reviewBeforeNext: rawItem.reviewBeforeNext === true,
    });
  });
  if (problems.length > 0) return { kind: "invalid", problems };
  return {
    kind: "plan",
    plan: { title: text(raw.title) || items[0]!.title, reason: text(raw.reason), items },
  };
}

const RESULT_BLOCK = /```pixel-office-result\s*\n[\s\S]*?\n```/g;

/** 사람에게 보여줄 팀장의 답 (결과 블록은 계획서 카드로 따로 보여주므로 뺌) */
export function leadReplyText(finalAnswer: string): string {
  return finalAnswer.replace(RESULT_BLOCK, "").trim();
}
