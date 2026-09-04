import { createWriteStream, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export class BoundedJsonlWriter {
  readonly path: string;
  private readonly maxBytes: number;
  private bytesWritten = 0;
  private truncated = false;
  private readonly stream;

  constructor(directory: string, runId: string, maxBytes = 5 * 1024 * 1024) {
    const absoluteDirectory = resolve(directory);
    mkdirSync(absoluteDirectory, { recursive: true });
    this.path = join(absoluteDirectory, `${runId}.jsonl`);
    this.maxBytes = maxBytes;
    this.stream = createWriteStream(this.path, { encoding: "utf8", flags: "wx" });
  }

  write(value: unknown): void {
    if (this.truncated) return;

    const line = `${JSON.stringify(value)}\n`;
    const byteLength = Buffer.byteLength(line);
    if (this.bytesWritten + byteLength > this.maxBytes) {
      this.truncated = true;
      this.stream.write(`${JSON.stringify({ type: "log_truncated", maxBytes: this.maxBytes })}\n`);
      return;
    }

    this.bytesWritten += byteLength;
    this.stream.write(line);
  }

  async close(): Promise<void> {
    await new Promise<void>((resolveClose, reject) => {
      this.stream.once("error", reject);
      this.stream.end(resolveClose);
    });
  }
}

export function pruneRuntimeLogs(directory: string, keep = 20): string[] {
  mkdirSync(directory, { recursive: true });
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".jsonl"))
    .map((file) => ({
      path: join(directory, file),
      modified: statSync(join(directory, file)).mtimeMs,
    }))
    .sort((left, right) => right.modified - left.modified);

  const removed: string[] = [];
  for (const file of files.slice(keep)) {
    unlinkSync(file.path);
    removed.push(basename(file.path));
  }
  return removed;
}
