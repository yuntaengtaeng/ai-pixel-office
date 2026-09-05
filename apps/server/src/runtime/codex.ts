import { DomainError } from "@ai-pixel-office/domain";
import { runCodexSpike, type CodexSpikeResult } from "../../../../scripts/runtime-spike/codex.ts";
import type { ApprovalDecision } from "@ai-pixel-office/runtime-protocol";
import type { RuntimeAdapter, RuntimeCallbacks, RuntimeRunInput } from "./index.ts";

type PendingApproval = {
  resolve: (decision: ApprovalDecision) => void;
};

type ActiveRun = {
  controller: AbortController;
  approvals: Map<string, PendingApproval>;
};

export class CodexRuntimeAdapter implements RuntimeAdapter {
  private readonly active = new Map<string, ActiveRun>();
  private readonly logDirectory: string;

  constructor(logDirectory = ".runtime-logs") {
    this.logDirectory = logDirectory;
  }

  async run(input: RuntimeRunInput, callbacks: RuntimeCallbacks): Promise<CodexSpikeResult> {
    if (this.active.has(input.runId)) {
      throw new DomainError("RUN_ALREADY_ACTIVE", `Run is already active: ${input.runId}`, 409);
    }
    const active: ActiveRun = { controller: new AbortController(), approvals: new Map() };
    this.active.set(input.runId, active);
    try {
      return await runCodexSpike({
        runId: input.runId,
        prompt: input.prompt,
        cwd: input.cwd,
        model: input.modelName,
        reasoningEffort: input.reasoningEffort,
        resumeThreadId: input.resumeThreadId,
        sandbox: input.writable ? "workspace-write" : "read-only",
        browser: input.browser,
        figma: input.figma,
        approvalPolicy: "on-request",
        timeoutMs: input.limits.maxDurationMs,
        logDirectory: this.logDirectory,
        signal: active.controller.signal,
        onEvent: callbacks.onEvent,
        onApprovalRequest: (request) => {
          return new Promise<ApprovalDecision>((resolveApproval) => {
            active.approvals.set(String(request.id), { resolve: resolveApproval });
            callbacks.onApprovalPending(request);
          });
        },
      });
    } finally {
      for (const approval of active.approvals.values()) approval.resolve("cancel");
      this.active.delete(input.runId);
    }
  }

  cancel(runId: string): boolean {
    const active = this.active.get(runId);
    if (!active) return false;
    for (const approval of active.approvals.values()) approval.resolve("cancel");
    active.approvals.clear();
    active.controller.abort();
    return true;
  }

  resolveApproval(runId: string, requestId: string, decision: ApprovalDecision): boolean {
    const active = this.active.get(runId);
    const approval = active?.approvals.get(requestId);
    if (!active || !approval) return false;
    active.approvals.delete(requestId);
    approval.resolve(decision);
    return true;
  }
}
