import type { ResultFormat } from "@ai-pixel-office/domain/entities";
import { requiredFields, USER_QUESTIONS_FIELD } from "./output-contract.ts";

export type RunGuidanceInput = {
  resultFormat?: ResultFormat;
  projectMemo?: string;
  verificationCommands: string[];
  /** 앞 기안의 결과 (제목, 요약, 보고한 결과) */
  earlierResults?: Array<{ title: string; summary: string; reportedResult?: unknown }>;
};

/** 동료 지침에 덧붙일 프로젝트 맥락, 확인 방법, 앞 기안 결과, 결과 형식 */
export function buildRunGuidance(input: RunGuidanceInput): string {
  const sections: string[] = [];
  if (input.projectMemo?.trim()) sections.push(`PROJECT NOTES\n${input.projectMemo.trim()}`);
  if (input.verificationCommands.length > 0) {
    sections.push(
      `PROJECT CHECKS\nAfter changing files, run these commands and keep their results:\n${input.verificationCommands
        .map((command) => `- ${command}`)
        .join("\n")}`,
    );
  }
  for (const earlier of input.earlierResults ?? []) {
    const body =
      earlier.reportedResult !== undefined
        ? JSON.stringify(earlier.reportedResult, null, 2)
        : earlier.summary;
    sections.push(`EARLIER REQUEST RESULT: ${earlier.title}\n${body}`);
  }
  if (input.resultFormat) sections.push(resultFormatSection(input.resultFormat));
  return sections.join("\n\n");
}

/** 일이 끝날 때 낼 결과 형식과 제출 방법 */
export function resultFormatSection(format: ResultFormat): string {
  const fields = requiredFields(format);
  return [
    "RESULT",
    `When the work is done, submit a JSON object with exactly these fields: ${fields.join(", ")}.`,
    `Use "unknown" with a reason for values you cannot fill. Put questions only the user can answer in ${USER_QUESTIONS_FIELD} (an empty array if none); leave decisions for the next role in open_questions.`,
    "If a report_result tool is available, call it once with { result: <that object> }.",
    "Otherwise end your final answer with the object in a fenced block:",
    "```pixel-office-result",
    "{ ... }",
    "```",
  ].join("\n");
}
