import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CodexAppServerClient } from "./json-rpc.ts";
import { createNormalizationState, normalizeAppServerMessage } from "./normalize-event.ts";
import { BoundedJsonlWriter, pruneRuntimeLogs } from "./runtime-log.ts";
import type { AgentEvent, ApprovalDecision, JsonRpcMessage } from "./types.ts";
import type { ReasoningEffort } from "../../packages/domain/src/entities.ts";

type ThreadStartResult = { thread: { id: string } };
type TurnStartResult = { turn: { id: string } };

export type CodexSpikeOptions = {
  runId?: string;
  prompt: string;
  cwd?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  resumeThreadId?: string;
  approvalPolicy?: "untrusted" | "on-request" | "never";
  approvalDecision?: ApprovalDecision;
  sandbox?: "read-only" | "workspace-write";
  browser?: boolean;
  figma?: boolean;
  timeoutMs?: number;
  cancelAfterMs?: number;
  logDirectory?: string | false;
  onEvent?: (event: AgentEvent) => void;
  onApprovalRequest?: (request: {
    id: string | number;
    method: string;
    params: Record<string, unknown>;
  }) => Promise<ApprovalDecision>;
  signal?: AbortSignal;
};

export type CodexSpikeResult = {
  runId: string;
  threadId: string;
  turnId: string;
  eventLogRef?: string;
  events: AgentEvent[];
};

function approvalResponse(message: JsonRpcMessage, decision: ApprovalDecision): unknown {
  if (
    message.method === "item/commandExecution/requestApproval" ||
    message.method === "item/fileChange/requestApproval"
  ) {
    return { decision };
  }
  if (message.method === "item/permissions/requestApproval") {
    return { permissions: {}, scope: "turn" };
  }
  if (message.method === "item/tool/requestUserInput") {
    return { answers: {} };
  }
  throw new Error(`Unsupported Codex server request: ${message.method ?? "unknown"}`);
}

export async function runCodexSpike(options: CodexSpikeOptions): Promise<CodexSpikeResult> {
  const runId = options.runId ?? randomUUID();
  const cwd = resolve(options.cwd ?? process.cwd());
  const timeoutMs = options.timeoutMs ?? 120_000;
  const events: AgentEvent[] = [];
  const state = createNormalizationState();
  let acceptRunEvents = false;
  const client = new CodexAppServerClient();
  const logDirectory =
    options.logDirectory === false ? false : resolve(options.logDirectory ?? ".runtime-logs");
  const logWriter = logDirectory ? new BoundedJsonlWriter(logDirectory, runId) : null;
  if (logDirectory) pruneRuntimeLogs(logDirectory);

  const emit = (event: AgentEvent) => {
    events.push(event);
    options.onEvent?.(event);
  };

  client.onMessage((message) => {
    logWriter?.write({ timestamp: new Date().toISOString(), message });
    // A resumed thread may emit snapshots from older turns. Keep them in the raw log,
    // but do not let a previous answer become this run's progress or final result.
    if (!acceptRunEvents) return;
    for (const event of normalizeAppServerMessage(message, state)) emit(event);
  });
  client.setServerRequestHandler(async (message) => {
    const decision =
      options.onApprovalRequest && message.id !== undefined && message.method
        ? await options.onApprovalRequest({
            id: message.id,
            method: message.method,
            params: message.params ?? {},
          })
        : (options.approvalDecision ?? "decline");
    return approvalResponse(message, decision);
  });

  let threadId = "";
  let turnId = "";
  let abortListener: (() => void) | undefined;
  try {
    if (options.signal?.aborted) throw new Error("Run cancelled before start");
    client.start();
    await client.initialize();

    if (options.resumeThreadId) {
      const resumed = await client.request<ThreadStartResult>("thread/resume", {
        threadId: options.resumeThreadId,
        cwd,
        approvalPolicy: options.approvalPolicy ?? "on-request",
        sandbox: options.sandbox ?? "workspace-write",
        config: {
          ...(options.reasoningEffort ? { model_reasoning_effort: options.reasoningEffort } : {}),
          web_search: options.browser ? "live" : "disabled",
          mcp_servers: options.figma ? { figma: { url: "https://mcp.figma.com/mcp" } } : {},
        },
      });
      threadId = resumed.thread.id;
    } else {
      const started = await client.request<ThreadStartResult>("thread/start", {
        cwd,
        model: options.model ?? null,
        approvalPolicy: options.approvalPolicy ?? "on-request",
        sandbox: options.sandbox ?? "workspace-write",
        config: {
          ...(options.reasoningEffort ? { model_reasoning_effort: options.reasoningEffort } : {}),
          web_search: options.browser ? "live" : "disabled",
          mcp_servers: options.figma ? { figma: { url: "https://mcp.figma.com/mcp" } } : {},
        },
        serviceName: "ai_pixel_office_runtime_spike",
      });
      threadId = started.thread.id;
    }

    acceptRunEvents = true;
    const turnResult = await client.request<TurnStartResult>("turn/start", {
      threadId,
      input: [{ type: "text", text: options.prompt }],
    });
    turnId = turnResult.turn.id;

    abortListener = () => {
      void client.request("turn/interrupt", { threadId, turnId }).catch(() => undefined);
    };
    options.signal?.addEventListener("abort", abortListener, { once: true });
    if (options.signal?.aborted) abortListener();

    let cancelTimer: NodeJS.Timeout | undefined;
    if (options.cancelAfterMs !== undefined) {
      cancelTimer = setTimeout(() => {
        void client.request("turn/interrupt", { threadId, turnId }).catch(() => undefined);
      }, options.cancelAfterMs);
    }

    try {
      await client.waitFor(
        (message) =>
          message.method === "turn/completed" &&
          (message.params?.turn as Record<string, unknown> | undefined)?.id === turnId,
        timeoutMs,
      );
    } catch (error) {
      await client.request("turn/interrupt", { threadId, turnId }).catch(() => undefined);
      throw error;
    } finally {
      if (cancelTimer) clearTimeout(cancelTimer);
    }

    return {
      runId,
      threadId,
      turnId,
      eventLogRef: logWriter?.path,
      events,
    };
  } finally {
    if (abortListener) options.signal?.removeEventListener("abort", abortListener);
    await client.close();
    await logWriter?.close();
  }
}

function formatEvent(event: AgentEvent): string {
  switch (event.type) {
    case "tool_started":
      return `tool_started: ${event.tool}${event.detail ? ` (${event.detail})` : ""}`;
    case "tool_completed":
      return `tool_completed: ${event.tool} (${event.status ?? "unknown"})`;
    case "permission_requested":
      return `permission_requested: ${event.permission}`;
    case "message":
      return `message: ${event.content}`;
    case "completed":
      return `completed: ${event.result.summary}`;
    case "failed":
      return `failed: ${event.error}`;
    default:
      return event.type;
  }
}

async function main(): Promise<void> {
  const prompt =
    process.argv.slice(2).join(" ").trim() || "Summarize the purpose of plan.md in three bullets.";
  const result = await runCodexSpike({
    prompt,
    approvalDecision: "decline",
    onEvent: (event) => console.log(`[UI Reviewer] ${formatEvent(event)}`),
  });
  console.log(
    JSON.stringify({ threadId: result.threadId, eventLogRef: result.eventLogRef }, null, 2),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
