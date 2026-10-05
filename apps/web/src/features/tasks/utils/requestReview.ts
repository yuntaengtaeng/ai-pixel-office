import type { AgentRun } from "@ai-pixel-office/domain/entities";

export type VerificationResult = { command: string; passed: boolean };

/** 가장 최근에 프로젝트 확인을 실행한 run의 확인 결과 (확인한 적이 없으면 빈 목록) */
export function latestVerifications(runsNewestFirst: AgentRun[]): VerificationResult[] {
  for (const run of runsNewestFirst) {
    const value = run.result?.metadata?.verifications;
    if (!Array.isArray(value)) continue;
    return value.filter(
      (item): item is VerificationResult =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as VerificationResult).command === "string" &&
        typeof (item as VerificationResult).passed === "boolean",
    );
  }
  return [];
}
