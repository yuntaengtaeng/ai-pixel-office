import type { ContractCheck } from "./output-contract.ts";

export type VerificationFact = {
  command: string;
  passed: boolean;
};

/** 정상 완료된 Run에서 모은 사실 */
export type CompletedRunFacts = {
  contract: ContractCheck;
  verifications: VerificationFact[];
  /** 확인 실패로 같은 담당에게 이미 한 번 되돌려 보냈는지 */
  verificationRetryUsed: boolean;
  /** 결재할 변경이 있는지 */
  hasFileChanges: boolean;
  /** 바뀐 파일이 없어도 사람이 결과를 확인해야 하는지 (내가 보고 넘김) */
  reviewRequired?: boolean;
};

export type RunDecision =
  | { kind: "stop_incomplete_result"; missingFields: string[] }
  | { kind: "ask_user"; questions: string[] }
  | { kind: "return_to_assignee"; failed: VerificationFact[] }
  | { kind: "stop_verification_failed"; failed: VerificationFact[] }
  | { kind: "final_review" }
  | { kind: "complete_without_approval" };

/** 기안서 Run이 정상 완료된 뒤의 다음 행동 (처음 해당하는 규칙을 적용) */
export function decideAfterRun(facts: CompletedRunFacts): RunDecision {
  const { contract } = facts;
  if (contract.status === "missing") return { kind: "stop_incomplete_result", missingFields: [] };
  if (contract.status === "incomplete")
    return { kind: "stop_incomplete_result", missingFields: contract.missingFields };
  if (contract.status === "complete" && contract.userQuestions.length > 0)
    return { kind: "ask_user", questions: contract.userQuestions };

  const failed = facts.verifications.filter((verification) => !verification.passed);
  if (failed.length > 0)
    return facts.verificationRetryUsed
      ? { kind: "stop_verification_failed", failed }
      : { kind: "return_to_assignee", failed };

  return facts.hasFileChanges || facts.reviewRequired
    ? { kind: "final_review" }
    : { kind: "complete_without_approval" };
}
