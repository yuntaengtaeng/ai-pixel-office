import {
  DomainError,
  type AgentModel,
  type ReasoningEffort,
  type RunLimits,
} from "../../../packages/domain/src/index.ts";
import { runCodexSpike, type CodexSpikeResult } from "../../../scripts/runtime-spike/codex.ts";
import type { AgentEvent, ApprovalDecision } from "../../../scripts/runtime-spike/types.ts";

export type RuntimeRunInput = {
  runId: string;
  runtime: AgentModel;
  modelName?: string;
  reasoningEffort?: ReasoningEffort;
  prompt: string;
  cwd: string;
  resumeThreadId?: string;
  writable: boolean;
  browser: boolean;
  figma: boolean;
  conversational: boolean;
  limits: RunLimits;
};

export type RuntimeRunResult = {
  runId: string;
  threadId: string;
  turnId: string;
  eventLogRef?: string;
  events: AgentEvent[];
};

export type RuntimeCallbacks = {
  onEvent: (event: AgentEvent) => void;
  onApprovalPending: (request: {
    id: string | number;
    method: string;
    params: Record<string, unknown>;
  }) => void;
};

export interface RuntimeAdapter {
  run(input: RuntimeRunInput, callbacks: RuntimeCallbacks): Promise<RuntimeRunResult>;
  cancel(runId: string): boolean;
  resolveApproval(runId: string, requestId: string, decision: ApprovalDecision): boolean;
}

export class RuntimeRouter implements RuntimeAdapter {
  private readonly adapters: Record<AgentModel, RuntimeAdapter>;
  private readonly active = new Map<string, RuntimeAdapter>();

  constructor(adapters: Record<AgentModel, RuntimeAdapter>) {
    this.adapters = adapters;
  }

  async run(input: RuntimeRunInput, callbacks: RuntimeCallbacks): Promise<RuntimeRunResult> {
    const adapter = this.adapters[input.runtime];
    this.active.set(input.runId, adapter);
    try {
      return await adapter.run(input, callbacks);
    } finally {
      this.active.delete(input.runId);
    }
  }

  cancel(runId: string): boolean {
    return this.active.get(runId)?.cancel(runId) ?? false;
  }

  resolveApproval(runId: string, requestId: string, decision: ApprovalDecision): boolean {
    return this.active.get(runId)?.resolveApproval(runId, requestId, decision) ?? false;
  }
}

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
