import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import type {
  CreateKnowledgeDocumentInput,
  KnowledgeDocument,
  UpdateKnowledgeDocumentInput,
} from "@ai-pixel-office/domain";
import { DomainError } from "@ai-pixel-office/domain";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function safePart(value: string): string {
  return (
    Array.from(value.normalize("NFKC"))
      .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
      .join("")
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "기록"
  );
}

function parseScalar(lines: string[], key: string): string | undefined {
  const prefix = `${key}:`;
  const line = lines.find((candidate) => candidate.startsWith(prefix));
  if (!line) return undefined;
  const value = line.slice(prefix.length).trim();
  try {
    return JSON.parse(value) as string;
  } catch {
    return value || undefined;
  }
}

function parseStringArray(lines: string[], key: string): string[] {
  const prefix = `${key}:`;
  const value = lines
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseDocument(workspaceId: string, fileName: string, source: string): KnowledgeDocument {
  const match = source.match(FRONTMATTER);
  const lines = match?.[1].split(/\r?\n/) ?? [];
  const fallbackId = basename(fileName, ".md").split("--").at(-1) ?? randomUUID();
  const statDate = new Date().toISOString();
  return {
    id: parseScalar(lines, "id") ?? fallbackId,
    workspaceId,
    title: parseScalar(lines, "title") ?? basename(fileName, ".md"),
    content: source.slice(match?.[0].length ?? 0).trim(),
    fileName,
    taskId: parseScalar(lines, "taskId"),
    runId: parseScalar(lines, "runId"),
    referenceTaskIds: parseStringArray(lines, "referenceTaskIds"),
    createdAt: parseScalar(lines, "createdAt") ?? statDate,
    updatedAt: parseScalar(lines, "updatedAt") ?? statDate,
  };
}

function serialize(document: KnowledgeDocument): string {
  const metadata = [
    "---",
    `id: ${JSON.stringify(document.id)}`,
    `title: ${JSON.stringify(document.title)}`,
    `workspaceId: ${JSON.stringify(document.workspaceId)}`,
    ...(document.taskId ? [`taskId: ${JSON.stringify(document.taskId)}`] : []),
    ...(document.runId ? [`runId: ${JSON.stringify(document.runId)}`] : []),
    `referenceTaskIds: ${JSON.stringify(document.referenceTaskIds)}`,
    `createdAt: ${JSON.stringify(document.createdAt)}`,
    `updatedAt: ${JSON.stringify(document.updatedAt)}`,
    "---",
  ];
  return `${metadata.join("\n")}\n\n${document.content.trimEnd()}\n`;
}

export class KnowledgeDocumentStore {
  private readonly rootDirectory: string;

  constructor(rootDirectory: string) {
    this.rootDirectory = rootDirectory;
  }

  private directory(workspaceId: string): string {
    if (!/^[\w-]+$/.test(workspaceId))
      throw new DomainError("INVALID_INPUT", "Invalid workspace", 400);
    const directory = resolve(this.rootDirectory, "records", workspaceId);
    const root = `${resolve(this.rootDirectory, "records")}${sep}`;
    if (!`${directory}${sep}`.startsWith(root))
      throw new DomainError("INVALID_INPUT", "Invalid workspace", 400);
    return directory;
  }

  async list(workspaceId: string): Promise<KnowledgeDocument[]> {
    const directory = this.directory(workspaceId);
    await mkdir(directory, { recursive: true });
    const files = (await readdir(directory)).filter((file) => file.endsWith(".md"));
    const documents = await Promise.all(
      files.map(async (fileName) =>
        parseDocument(workspaceId, fileName, await readFile(join(directory, fileName), "utf8")),
      ),
    );
    return documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async create(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    const timestamp = new Date().toISOString();
    const document: KnowledgeDocument = {
      ...input,
      id: randomUUID(),
      fileName: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      referenceTaskIds: input.referenceTaskIds ?? [],
    };
    document.fileName = `${safePart(document.title)}--${document.id}.md`;
    const directory = this.directory(input.workspaceId);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, document.fileName), serialize(document), {
      encoding: "utf8",
      flag: "wx",
    });
    return document;
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateKnowledgeDocumentInput,
  ): Promise<KnowledgeDocument> {
    const current = (await this.list(workspaceId)).find((document) => document.id === id);
    if (!current) throw new DomainError("NOT_FOUND", `Document not found: ${id}`, 404);
    const document = { ...current, ...patch, updatedAt: new Date().toISOString() };
    const nextFileName = `${safePart(document.title)}--${document.id}.md`;
    const directory = this.directory(workspaceId);
    await writeFile(
      join(directory, nextFileName),
      serialize({ ...document, fileName: nextFileName }),
      "utf8",
    );
    if (nextFileName !== current.fileName) await unlink(join(directory, current.fileName));
    return { ...document, fileName: nextFileName };
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const current = (await this.list(workspaceId)).find((document) => document.id === id);
    if (!current) throw new DomainError("NOT_FOUND", `Document not found: ${id}`, 404);
    await unlink(join(this.directory(workspaceId), current.fileName));
  }

  async import(workspaceId: string, fileName: string, source: string): Promise<KnowledgeDocument> {
    const parsed = parseDocument(workspaceId, basename(fileName), source);
    return this.create({
      workspaceId,
      title: parsed.title,
      content: parsed.content,
      taskId: parsed.taskId,
      runId: parsed.runId,
      referenceTaskIds: parsed.referenceTaskIds,
    });
  }
}
