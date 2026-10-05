import type { AgentEvent } from "@ai-pixel-office/runtime-protocol";
import { readResultBlock } from "./output-contract.ts";
import type { ExecutedCommand } from "./verification.ts";

/** 한 run이 남긴 판단용 사실 */
export type RunFacts = {
  /** 보고 도구로 낸 결과, 없으면 마지막 응답의 결과 블록 */
  reportedResult?: unknown;
  commands: ExecutedCommand[];
  /** 파일 쓰기·수정 도구가 바꾼 경로 */
  changedPaths: string[];
};

export function collectRunFacts(events: AgentEvent[], finalAnswer: string): RunFacts {
  let reported: unknown;
  const commands: ExecutedCommand[] = [];
  const changedPaths = new Set<string>();
  for (const event of events) {
    if (event.type === "result_reported") reported = event.result;
    if (event.type === "command_finished")
      commands.push({ command: event.command, succeeded: event.succeeded });
    if (event.type === "files_changed") for (const path of event.paths) changedPaths.add(path);
  }
  const reportedResult = reported ?? readResultBlock(finalAnswer);
  return {
    ...(reportedResult !== undefined ? { reportedResult } : {}),
    commands,
    changedPaths: [...changedPaths],
  };
}
