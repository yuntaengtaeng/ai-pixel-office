import type { AgentEvent, JsonRpcMessage } from "./types.ts";

export type NormalizationState = {
  lastAgentMessage: string;
};

export function createNormalizationState(): NormalizationState {
  return { lastAgentMessage: "" };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function itemTool(item: Record<string, unknown>): string | null {
  switch (item.type) {
    case "commandExecution":
      return "terminal";
    case "fileChange":
      return "file_write";
    case "webSearch":
      return "web_search";
    case "mcpToolCall":
      return `mcp:${text(item.server) ?? "unknown"}/${text(item.tool) ?? "unknown"}`;
    case "dynamicToolCall":
      return `tool:${text(item.tool) ?? "unknown"}`;
    default:
      return null;
  }
}

function approvalName(method: string): string | null {
  if (method === "item/commandExecution/requestApproval") return "terminal";
  if (method === "item/fileChange/requestApproval") return "file_write";
  if (method === "item/permissions/requestApproval") return "runtime_permissions";
  return null;
}

function usageEvent(params: Record<string, unknown>): AgentEvent {
  const tokenUsage = record(params.tokenUsage);
  const total = record(tokenUsage.total);
  const last = record(tokenUsage.last);
  const source = Object.keys(last).length > 0 ? last : total;
  return {
    type: "usage_updated",
    usage: {
      inputTokens: typeof source.inputTokens === "number" ? source.inputTokens : undefined,
      outputTokens: typeof source.outputTokens === "number" ? source.outputTokens : undefined,
      cachedInputTokens:
        typeof source.cachedInputTokens === "number" ? source.cachedInputTokens : undefined,
    },
  };
}

export function normalizeAppServerMessage(
  message: JsonRpcMessage,
  state: NormalizationState,
): AgentEvent[] {
  const method = message.method;
  if (!method) return [];
  const params = record(message.params);

  const approval = approvalName(method);
  if (approval && message.id !== undefined) {
    return [
      {
        type: "permission_requested",
        permission: approval,
        requestId: message.id,
        details: params,
      },
    ];
  }

  if (method === "turn/started") {
    const turn = record(params.turn);
    return [
      {
        type: "started",
        threadId: text(params.threadId),
        turnId: text(turn.id),
      },
    ];
  }

  if (method === "thread/tokenUsage/updated") return [usageEvent(params)];

  if (method === "item/started") {
    const item = record(params.item);
    const tool = itemTool(item);
    if (!tool) return [];
    return [
      {
        type: "tool_started",
        tool,
        detail: text(item.command) ?? text(item.query),
      },
    ];
  }

  if (method === "item/completed") {
    const item = record(params.item);
    if (item.type === "agentMessage") {
      const content = text(item.text) ?? "";
      state.lastAgentMessage = content;
      return content ? [{ type: "message", content }] : [];
    }

    const tool = itemTool(item);
    const events: AgentEvent[] = [];
    if (item.type === "fileChange" && Array.isArray(item.changes)) {
      for (const changeValue of item.changes) {
        const change = record(changeValue);
        const path = text(change.path);
        if (path) {
          events.push({
            type: "artifact_created",
            artifact: { name: path.split(/[\\/]/).at(-1) ?? path, type: "file", path },
          });
        }
      }
    }
    if (tool) events.push({ type: "tool_completed", tool, status: text(item.status) });
    return events;
  }

  if (method === "error") {
    const error = record(params.error);
    return [{ type: "failed", error: text(error.message) ?? "Codex runtime error" }];
  }

  if (method === "turn/completed") {
    const turn = record(params.turn);
    const status = text(turn.status);
    if (status === "interrupted") return [{ type: "cancelled", cleanupPolicy: "preserve" }];
    if (status === "failed") {
      const error = record(turn.error);
      return [{ type: "failed", error: text(error.message) ?? "Codex turn failed" }];
    }
    if (status === "completed") {
      return [{ type: "completed", result: { summary: state.lastAgentMessage } }];
    }
  }

  return [];
}
