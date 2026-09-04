export type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export type AgentEvent =
  | { type: "started"; threadId?: string; turnId?: string }
  | { type: "message"; content: string }
  | { type: "tool_started"; tool: string; detail?: string }
  | { type: "tool_completed"; tool: string; status?: string }
  | {
      type: "permission_requested";
      permission: string;
      requestId: string | number;
      details?: Record<string, unknown>;
    }
  | {
      type: "artifact_created";
      artifact: { name: string; type: string; path?: string };
    }
  | {
      type: "usage_updated";
      usage: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number };
    }
  | { type: "completed"; result: { summary: string } }
  | { type: "cancelled"; cleanupPolicy: "preserve" }
  | { type: "failed"; error: string };

export type RuntimeCapabilities = {
  nonInteractive: boolean;
  structuredEvents: boolean;
  toolEvents: boolean;
  interactiveApproval: boolean;
  resumableSession: boolean;
  cancellation: boolean;
  usageReporting: boolean;
  workingDirectory: boolean;
};

export type JsonRpcId = string | number;

export type JsonRpcMessage = {
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};
