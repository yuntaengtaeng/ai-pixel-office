import type { AgentModel, ReasoningEffort, RunLimits } from "@ai-pixel-office/domain";
import type { AgentEvent, ApprovalDecision } from "@ai-pixel-office/runtime-protocol";

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
