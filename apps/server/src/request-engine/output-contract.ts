import type { ResultFormat } from "@ai-pixel-office/domain/entities";

/** 결과 형식별 Handoff 필드 (Product Team Handoff contract v1) */
const HANDOFF_FIELDS: Record<ResultFormat, string[]> = {
  ux: [
    "type",
    "revision",
    "status",
    "problem",
    "user_goal",
    "primary_flow",
    "states",
    "edge_cases",
    "acceptance_criteria",
    "open_questions",
  ],
  ui: [
    "type",
    "revision",
    "status",
    "source_ux_handoff",
    "screen_hierarchy",
    "component_hierarchy",
    "component_states",
    "interaction_states",
    "responsive_behavior",
    "accessibility_constraints",
    "design_system_mapping",
    "assets",
    "open_questions",
  ],
  developer: [
    "type",
    "status",
    "implemented_scope",
    "changed_contracts",
    "verification",
    "deviations",
    "unresolved_questions",
  ],
};

export const USER_QUESTIONS_FIELD = "user_questions";

/** Handoff 필드 + 사용자에게만 물을 질문 */
export function requiredFields(type: ResultFormat): string[] {
  return [...HANDOFF_FIELDS[type], USER_QUESTIONS_FIELD];
}

export type ContractCheck =
  | { status: "not_required" }
  | { status: "missing" }
  | { status: "incomplete"; missingFields: string[] }
  | { status: "complete"; userQuestions: string[] };

/** 동료가 낸 결과가 형식을 갖췄는지와 사용자에게 물을 질문 */
export function checkOutputContract(
  type: ResultFormat | undefined,
  payload: unknown,
): ContractCheck {
  if (!type) return { status: "not_required" };
  if (!isRecord(payload)) return { status: "missing" };
  const missingFields = requiredFields(type).filter((field) => !(field in payload));
  if (missingFields.length > 0) return { status: "incomplete", missingFields };
  return { status: "complete", userQuestions: userQuestionsOf(payload[USER_QUESTIONS_FIELD]) };
}

const RESULT_BLOCK = /```pixel-office-result\s*\n([\s\S]*?)\n```/g;

/** 마지막 응답의 ```pixel-office-result 블록에서 결과 읽기 (보고 도구를 쓸 수 없는 runtime용, 여러 개면 마지막) */
export function readResultBlock(text: string): unknown {
  let last: string | undefined;
  for (const match of text.matchAll(RESULT_BLOCK)) last = match[1];
  if (last === undefined) return undefined;
  try {
    return JSON.parse(last);
  } catch {
    return undefined;
  }
}

function userQuestionsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : isRecord(item) ? item.question : undefined))
    .filter((question): question is string => typeof question === "string" && !!question.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
