import type { AgentRun, Task } from "@ai-pixel-office/domain/entities";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 동료가 보고 도구로 낸 결과 (없으면 undefined) */
export function reportedResultOf(
  run: Pick<AgentRun, "result"> | undefined,
): Record<string, unknown> | undefined {
  const reported = run?.result?.metadata?.reportedResult;
  return isRecord(reported) ? reported : undefined;
}

function questionText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (isRecord(value) && typeof value.question === "string") return value.question.trim();
  return "";
}

/** 답변을 기다리는 기안서에서 동료가 사람에게 물은 질문 (마지막으로 끝난 run 기준) */
export function openQuestionsOf(task: Pick<Task, "status">, runsNewestFirst: AgentRun[]): string[] {
  if (task.status !== "needs_input") return [];
  const lastCompleted = runsNewestFirst.find((run) => run.status === "completed");
  const questions = reportedResultOf(lastCompleted)?.user_questions;
  return Array.isArray(questions) ? questions.map(questionText).filter(Boolean) : [];
}

const FIELD_LABEL: Record<string, string> = {
  problem: "문제",
  user_goal: "사용자 목표",
  primary_flow: "주요 흐름",
  states: "상태",
  edge_cases: "예외 상황",
  acceptance_criteria: "완료 조건",
  open_questions: "다음 담당이 정할 것",
  screen_hierarchy: "화면 구성",
  component_hierarchy: "컴포넌트 구성",
  component_states: "컴포넌트 상태",
  interaction_states: "상호작용 상태",
  responsive_behavior: "화면 크기별 동작",
  accessibility_constraints: "접근성",
  design_system_mapping: "디자인 시스템 연결",
  assets: "필요한 자원",
  implemented_scope: "구현한 범위",
  changed_contracts: "바뀐 약속",
  verification: "확인",
  deviations: "명세와 달라진 점",
  unresolved_questions: "남은 질문",
};

/** 화면에 따로 보여주거나 보여줄 필요가 없는 결과 필드 */
const HIDDEN_FIELDS = new Set([
  "type",
  "revision",
  "status",
  "source_ux_handoff",
  "user_questions",
]);

export type ResultSection = { key: string; label: string; paragraphs: string[]; items: string[] };

/** 값 하나를 한 줄 글로 (목록은 쉼표, 객체는 "이름: 값; …") */
function inlineText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(inlineText).filter(Boolean).join(", ");
  if (isRecord(value))
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${inlineText(item)}`)
      .join("; ");
  return value === undefined || value === null ? "" : String(value);
}

/** 목록에 넣을 줄 (객체는 항목마다 "이름: 값" 한 줄) */
function linesOf(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(linesOf);
  if (isRecord(value))
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${inlineText(item)}`)
      .filter((line) => !line.endsWith(": "));
  return value === undefined || value === null ? [] : [String(value)];
}

/** 보고한 결과를 읽기 좋은 문단과 목록으로 (알려진 필드는 업무 언어 제목, 순서는 결과에 적힌 대로) */
export function resultSections(reported: Record<string, unknown>): ResultSection[] {
  return Object.entries(reported)
    .filter(([key]) => !HIDDEN_FIELDS.has(key))
    .map(([key, value]) => ({
      key,
      label: FIELD_LABEL[key] ?? key,
      paragraphs: typeof value === "string" ? linesOf(value) : [],
      items: typeof value === "string" ? [] : linesOf(value),
    }))
    .filter((section) => section.paragraphs.length > 0 || section.items.length > 0);
}

/** 결과 요약이 보고한 결과를 그대로 옮긴 JSON이면 감춤 (결과 섹션으로 따로 보여줌) */
export function summaryWithoutReportedJson(summary: string): string {
  const withoutBlock = summary.replace(/```pixel-office-result\s*\n[\s\S]*?\n```/g, "").trim();
  return withoutBlock.startsWith("{") && withoutBlock.endsWith("}") ? "" : withoutBlock;
}
