import { createInterface, type Interface } from "node:readline";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawnCodex } from "./process.ts";
import type { JsonRpcId, JsonRpcMessage } from "./types.ts";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type ServerRequestHandler = (message: JsonRpcMessage) => Promise<unknown> | unknown;
type MessageListener = (message: JsonRpcMessage) => void;

export class CodexAppServerClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private nextId = 1;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private readonly listeners = new Set<MessageListener>();
  private readonly history: JsonRpcMessage[] = [];
  private serverRequestHandler: ServerRequestHandler | null = null;
  private closed = false;
  private stderr = "";

  start(): void {
    if (this.child) throw new Error("Codex app-server is already running");
    this.child = spawnCodex(["app-server", "--stdio"]);
    this.lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    this.lines.on("line", (line) => this.handleLine(line));
    this.child.stderr.on("data", (chunk: Buffer) => {
      this.stderr = `${this.stderr}${chunk.toString("utf8")}`.slice(-16_384);
    });
    this.child.once("error", (error) => this.rejectAll(error));
    this.child.once("exit", (code, signal) => {
      this.closed = true;
      const detail = this.stderr.trim();
      this.rejectAll(createCodexExitError(code, signal, detail));
    });
  }

  setServerRequestHandler(handler: ServerRequestHandler): void {
    this.serverRequestHandler = handler;
  }

  onMessage(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    this.send({ method, params });
  }

  request<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolveRequest, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`JSON-RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => resolveRequest(value as T),
        reject,
        timer,
      });
      this.send({ id, method, params });
    });
  }

  waitFor(
    predicate: (message: JsonRpcMessage) => boolean,
    timeoutMs: number,
  ): Promise<JsonRpcMessage> {
    const existing = this.history.findLast(predicate);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolveWait, reject) => {
      const stop = this.onMessage((message) => {
        if (!predicate(message)) return;
        clearTimeout(timer);
        stop();
        resolveWait(message);
      });
      const timer = setTimeout(() => {
        stop();
        reject(new Error("Timed out waiting for an app-server event"));
      }, timeoutMs);
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      clientInfo: {
        name: "ai_pixel_office",
        title: "AI Pixel Office Runtime Spike",
        version: "0.1.0",
      },
      capabilities: { experimentalApi: true },
    });
    this.notify("initialized");
  }

  async close(): Promise<void> {
    if (!this.child || this.closed) return;
    this.lines?.close();
    this.child.stdin.end();
    await new Promise<void>((resolveClose) => {
      const forceTimer = setTimeout(() => {
        this.child?.kill();
        resolveClose();
      }, 2_000);
      this.child?.once("exit", () => {
        clearTimeout(forceTimer);
        resolveClose();
      });
    });
  }

  private send(message: JsonRpcMessage): void {
    if (!this.child || this.closed) throw new Error("Codex app-server is not running");
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }

    this.history.push(message);
    if (this.history.length > 1_000) this.history.shift();
    for (const listener of this.listeners) listener(message);

    if (message.id !== undefined && message.method) {
      void this.handleServerRequest(message);
      return;
    }

    if (message.id === undefined) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message ?? "Unknown JSON-RPC error"));
    } else {
      pending.resolve(message.result);
    }
  }

  private async handleServerRequest(message: JsonRpcMessage): Promise<void> {
    if (message.id === undefined) return;
    try {
      if (!this.serverRequestHandler)
        throw new Error(`Unhandled server request: ${message.method}`);
      const result = await this.serverRequestHandler(message);
      this.send({ id: message.id, result });
    } catch (error) {
      this.send({
        id: message.id,
        error: { code: -32_000, message: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export function createCodexExitError(
  code: number | null,
  signal: NodeJS.Signals | null,
  detail: string,
): Error {
  if (detail.includes("Could not find home directory")) {
    return new Error(
      "Codex 설정 폴더에 접근할 수 없습니다. Codex 샌드박스 내부 터미널이 아닌 일반 Windows PowerShell 또는 Windows Terminal에서 npm.cmd run dev를 실행해 주세요.",
    );
  }
  return new Error(
    `Codex app-server exited (code=${String(code)}, signal=${String(signal)})${detail ? `: ${detail}` : ""}`,
  );
}
