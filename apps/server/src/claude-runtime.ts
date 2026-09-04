import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { DomainError } from "../../../packages/domain/src/index.ts";
import {
  BoundedJsonlWriter,
  pruneRuntimeLogs,
} from "../../../scripts/runtime-spike/runtime-log.ts";
import { spawnClaude } from "../../../scripts/runtime-spike/process.ts";
import type { AgentEvent, ApprovalDecision } from "../../../scripts/runtime-spike/types.ts";
import type {
  RuntimeAdapter,
  RuntimeCallbacks,
  RuntimeRunInput,
  RuntimeRunResult,
} from "./runtime.ts";

type ClaudeMessage = Record<string, unknown>;

export type ClaudeNormalizationState = {
  sessionId?: string;
  finalText?: string;
  started: boolean;
  toolNames: Map<string, string>;
};

type ActiveClaudeRun = {
  cancel: () => void;
};

export function createClaudeNormalizationState(): ClaudeNormalizationState {
  return { started: false, toolNames: new Map() };
}

export function normalizeClaudeMessage(
  message: ClaudeMessage,
  state: ClaudeNormalizationState,
): AgentEvent[] {
  const events: AgentEvent[] = [];
  const sessionId = stringValue(message.session_id);
  if (sessionId) state.sessionId = sessionId;

  if (message.type === "system" && message.subtype === "init" && !state.started) {
    state.started = true;
    events.push({ type: "started", threadId: state.sessionId });
  }

  if (message.type === "assistant") {
    const response = objectValue(message.message);
    const content = Array.isArray(response?.content) ? response.content : [];
    for (const rawBlock of content) {
      const block = objectValue(rawBlock);
      if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
        state.finalText = block.text;
        events.push({ type: "message", content: block.text });
      }
      if (block?.type === "tool_use") {
        const id = stringValue(block.id);
        const tool = stringValue(block.name) ?? "tool";
        if (id) state.toolNames.set(id, tool);
        events.push({
          type: "tool_started",
          tool,
          detail: summarizeToolInput(objectValue(block.input)),
        });
      }
    }
    const usage = usageEvent(objectValue(response?.usage));
    if (usage) events.push(usage);
  }

  if (message.type === "user") {
    const response = objectValue(message.message);
    const content = Array.isArray(response?.content) ? response.content : [];
    for (const rawBlock of content) {
      const block = objectValue(rawBlock);
      if (block?.type !== "tool_result") continue;
      const toolUseId = stringValue(block.tool_use_id);
      events.push({
        type: "tool_completed",
        tool: (toolUseId && state.toolNames.get(toolUseId)) || "tool",
        status: block.is_error === true ? "failed" : "completed",
      });
    }
  }

  if (message.type === "result") {
    const usage = usageEvent(objectValue(message.usage));
    if (usage) events.push(usage);
    const result = stringValue(message.result) ?? state.finalText ?? "";
    if (message.is_error === true || message.subtype !== "success") {
      events.push({ type: "failed", error: claudeResultError(message, result) });
    } else {
      events.push({ type: "completed", result: { summary: result } });
    }
  }

  return events;
}

export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  private readonly active = new Map<string, ActiveClaudeRun>();
  private readonly logDirectory: string;

  constructor(logDirectory = ".runtime-logs") {
    this.logDirectory = logDirectory;
  }

  async run(input: RuntimeRunInput, callbacks: RuntimeCallbacks): Promise<RuntimeRunResult> {
    if (this.active.has(input.runId)) {
      throw new DomainError("RUN_ALREADY_ACTIVE", `Run is already active: ${input.runId}`, 409);
    }
    if (input.resumeThreadId && !/^[a-zA-Z0-9_-]+$/.test(input.resumeThreadId)) {
      throw new DomainError("INVALID_CLAUDE_SESSION", "Claude session ID is invalid", 422);
    }

    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "dontAsk",
      "--max-turns",
      String(Math.max(1, input.limits.maxTurns)),
    ];
    if (input.modelName) args.push("--model", input.modelName);
    if (input.reasoningEffort) args.push("--effort", input.reasoningEffort);
    const tools = allowedTools(input);
    if (tools.length > 0) args.push("--allowedTools", tools.join(","));
    if (input.resumeThreadId) args.push("--resume", input.resumeThreadId);

    const child = spawnClaude(args, input.cwd);
    const events: AgentEvent[] = [];
    const state = createClaudeNormalizationState();
    const logDirectory = resolve(this.logDirectory);
    pruneRuntimeLogs(logDirectory);
    const logWriter = new BoundedJsonlWriter(logDirectory, input.runId);
    let stderr = "";
    let cancelled = false;
    let timedOut = false;
    let settled = false;
    let plainOutput = "";

    const emit = (event: AgentEvent) => {
      events.push(event);
      callbacks.onEvent(event);
    };
    const terminate = () => {
      cancelled = true;
      child.kill();
    };
    this.active.set(input.runId, { cancel: terminate });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, input.limits.maxDurationMs);
    try {
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
      lines.on("line", (line) => {
        if (!line.trim()) return;
        try {
          const message = JSON.parse(line) as ClaudeMessage;
          logWriter.write({ timestamp: new Date().toISOString(), message });
          for (const event of normalizeClaudeMessage(message, state)) emit(event);
        } catch {
          plainOutput = `${plainOutput}${plainOutput ? "\n" : ""}${line}`.slice(-100_000);
          logWriter.write({ timestamp: new Date().toISOString(), malformed: line.slice(0, 4_096) });
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = `${stderr}${chunk.toString("utf8")}`.slice(-16_384);
      });
      child.stdin.end(input.prompt, "utf8");

      await new Promise<void>((resolveExit, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => {
          settled = true;
          if (timedOut) {
            emit({
              type: "failed",
              error: `Claude 실행 제한 시간(${input.limits.maxDurationMs}ms)을 초과했습니다.`,
            });
          } else if (cancelled) {
            emit({ type: "cancelled", cleanupPolicy: "preserve" });
          } else if (code !== 0) {
            emit({ type: "failed", error: claudeExitError(code, signal, stderr) });
          }
          resolveExit();
        });
      });

      if (!events.some((event) => ["completed", "failed", "cancelled"].includes(event.type))) {
        const fallbackResult = state.finalText ?? plainOutput.trim();
        emit(
          fallbackResult
            ? { type: "completed", result: { summary: fallbackResult } }
            : { type: "failed", error: "Claude가 결과 없이 종료되었습니다." },
        );
      }
      return {
        runId: input.runId,
        threadId: state.sessionId ?? input.resumeThreadId ?? "",
        turnId: input.runId,
        eventLogRef: logWriter.path,
        events,
      };
    } catch (error) {
      if (!settled) child.kill();
      throw new Error(claudeSpawnError(error), { cause: error });
    } finally {
      clearTimeout(timeout);
      this.active.delete(input.runId);
      await logWriter.close();
    }
  }

  cancel(runId: string): boolean {
    const run = this.active.get(runId);
    if (!run) return false;
    run.cancel();
    return true;
  }

  resolveApproval(_runId: string, _requestId: string, _decision: ApprovalDecision): boolean {
    return false;
  }
}

function allowedTools(input: RuntimeRunInput): string[] {
  if (input.conversational) return [];
  const tools = ["Read", "Glob", "Grep"];
  if (input.writable) tools.push("Edit", "Write", "NotebookEdit");
  tools.push("Bash");
  if (input.browser) tools.push("WebFetch", "WebSearch");
  if (input.figma) tools.push("mcp__figma-remote-mcp", "mcp__figma");
  return tools;
}

function usageEvent(usage: Record<string, unknown> | undefined): AgentEvent | undefined {
  if (!usage) return undefined;
  const inputTokens = numberValue(usage.input_tokens);
  const outputTokens = numberValue(usage.output_tokens);
  const cachedInputTokens = numberValue(usage.cache_read_input_tokens);
  if (inputTokens === undefined && outputTokens === undefined && cachedInputTokens === undefined)
    return undefined;
  return { type: "usage_updated", usage: { inputTokens, outputTokens, cachedInputTokens } };
}

function summarizeToolInput(input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined;
  for (const key of ["command", "file_path", "path", "query", "url"]) {
    const value = input[key];
    if (typeof value === "string" && value) return value.slice(0, 500);
  }
  return undefined;
}

function claudeResultError(message: ClaudeMessage, fallback: string): string {
  const errors = Array.isArray(message.errors)
    ? message.errors.filter((value): value is string => typeof value === "string").join("; ")
    : "";
  return (
    errors ||
    stringValue(message.error) ||
    fallback ||
    `Claude 실행 실패: ${String(message.subtype ?? "unknown")}`
  );
}

function claudeExitError(
  code: number | null,
  signal: NodeJS.Signals | null,
  detail: string,
): string {
  const cleaned = detail.trim();
  if (/auth|login|credential/i.test(cleaned)) {
    return "Claude 인증이 필요합니다. 일반 터미널에서 claude를 실행하고 /login을 완료해 주세요.";
  }
  return `Claude CLI가 종료되었습니다 (code=${String(code)}, signal=${String(signal)})${cleaned ? `: ${cleaned}` : ""}`;
}

function claudeSpawnError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOENT|not recognized|cannot find/i.test(message)) {
    return "Claude CLI를 찾을 수 없습니다. Claude Code를 설치한 뒤 일반 터미널에서 claude 로그인을 완료해 주세요.";
  }
  return message;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
