import type {
  AgentModel,
  MessageAttachment,
  ReasoningEffort,
  RunLimits,
} from "@ai-pixel-office/domain";
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
  /** 사용자가 이번 메시지에 첨부한 파일. 이미지는 adapter가 지원하면 멀티모달 콘텐츠로 인라인하고, 그 외에는 prompt에 이미 경로가 텍스트로 포함되어 있다. */
  attachments?: MessageAttachment[];
};

export type RuntimeRunResult = {
  runId: string;
  threadId: string;
  turnId: string;
  eventLogRef?: string;
  events: AgentEvent[];
};

const VISION_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Provider가 공통으로 지원하는 raster 이미지 형식만 멀티모달 입력으로 전달, SVG는 일반 파일로 처리 */
export function isVisionAttachment(attachment: Pick<MessageAttachment, "mediaType">): boolean {
  return VISION_MEDIA_TYPES.has(attachment.mediaType.toLowerCase());
}

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
