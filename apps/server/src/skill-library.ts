import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import {
  DomainError,
  SKILL_ID_PATTERN,
  type AgentPermissions,
  type CreateSkillInput,
  type Skill,
  type SkillDetail,
  type SkillSource,
} from "@ai-pixel-office/domain";

/** 런타임에 등록되는 plugin 이름 (Claude에서는 `pixel-office-library:<skill>`) */
export const LIBRARY_PLUGIN_NAME = "pixel-office-library";
const METADATA_FILE = "pixel-office.json";
const SKILL_FILE = "SKILL.md";

type SkillMetadata = {
  title?: string;
  category?: string;
  source?: SkillSource;
  version?: string;
  teamId?: string;
  requiredPermissions?: Array<keyof AgentPermissions>;
  updatedAt?: string;
};

export type RunSkillBundle = {
  /** Claude local plugin 루트 */
  pluginRoot: string;
  /** Codex 추가 Skill 경로 */
  skillsRoot: string;
  skillIds: string[];
};

/** 앱 스킬 라이브러리 (스킬마다 `skills/<id>/SKILL.md` 폴더와 앱 정보 `pixel-office.json`) */
export class SkillLibrary {
  readonly root: string;
  readonly skillsRoot: string;
  private readonly runRoot: string;

  constructor(root: string) {
    this.root = root;
    this.skillsRoot = join(root, "skills");
    this.runRoot = join(root, ".runs");
    mkdirSync(this.skillsRoot, { recursive: true });
  }

  list(): Skill[] {
    return readdirSync(this.skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && SKILL_ID_PATTERN.test(entry.name))
      .map((entry) => this.readSummary(entry.name))
      .filter((skill): skill is Skill => skill !== undefined)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  get(id: string): SkillDetail | undefined {
    const summary = SKILL_ID_PATTERN.test(id) ? this.readSummary(id) : undefined;
    return summary && { ...summary, body: this.readSkillFile(id).body };
  }

  has(id: string): boolean {
    return SKILL_ID_PATTERN.test(id) && existsSync(join(this.skillsRoot, id, SKILL_FILE));
  }

  require(ids: string[]): Skill[] {
    return ids.map((id) => {
      const skill = SKILL_ID_PATTERN.test(id) ? this.readSummary(id) : undefined;
      if (!skill) throw new DomainError("SKILLS_NOT_FOUND", `Skill not found: ${id}`, 422);
      return skill;
    });
  }

  create(input: CreateSkillInput): SkillDetail {
    const id = input.id ?? this.uniqueId(slugify(input.title));
    if (this.has(id)) {
      throw new DomainError("SKILL_EXISTS", `같은 이름의 스킬이 이미 있어요: ${id}`, 409);
    }
    const directory = join(this.skillsRoot, id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, SKILL_FILE),
      renderSkillFile(id, input.description, input.instructions),
    );
    writeMetadata(directory, {
      title: input.title,
      category: input.category,
      source: "local",
      requiredPermissions: input.requiredPermissions ?? [],
      updatedAt: new Date().toISOString(),
    });
    return this.get(id) as SkillDetail;
  }

  /** 사용자가 만들거나 가져온 스킬 삭제 (Team이 설치한 스킬은 거부) */
  remove(id: string): void {
    const skill = this.get(id);
    if (!skill) throw new DomainError("NOT_FOUND", `Skill not found: ${id}`, 404);
    if (skill.source === "bundled") {
      throw new DomainError(
        "SKILL_BUNDLED",
        "팀과 함께 설치된 스킬은 지울 수 없어요. 사본을 만들어 고쳐 쓰세요.",
        409,
      );
    }
    rmSync(join(this.skillsRoot, id), { recursive: true, force: true });
  }

  /** bundled Team 스킬 폴더 설치 (같은 id의 bundled 스킬은 교체, 사용자 스킬과 겹치면 거부) */
  installBundled(
    sourceDirectory: string,
    metadata: { teamId: string; version: string; category: string },
  ): Skill {
    const id = sourceDirectory.split(/[\\/]/).filter(Boolean).at(-1) ?? "";
    if (!SKILL_ID_PATTERN.test(id) || !existsSync(join(sourceDirectory, SKILL_FILE))) {
      throw new DomainError("INVALID_SKILL_PACKAGE", `Invalid bundled skill: ${sourceDirectory}`);
    }
    const existing = this.get(id);
    if (existing && existing.source !== "bundled") {
      throw new DomainError(
        "SKILL_EXISTS",
        `같은 이름의 스킬이 이미 있어 팀 스킬을 설치할 수 없어요: ${id}`,
        409,
      );
    }
    const target = join(this.skillsRoot, id);
    rmSync(target, { recursive: true, force: true });
    cpSync(sourceDirectory, target, { recursive: true, dereference: true });
    const frontmatter = parseFrontmatter(readFileSync(join(target, SKILL_FILE), "utf8"));
    writeMetadata(target, {
      title: frontmatter.attributes.title ?? id,
      category: metadata.category,
      source: "bundled",
      version: metadata.version,
      teamId: metadata.teamId,
      requiredPermissions: ["fileRead"],
      updatedAt: new Date().toISOString(),
    });
    return this.readSummary(id) as Skill;
  }

  /** 지정한 스킬만 담은 실행용 plugin 폴더 생성 (Claude는 `pluginRoot`, Codex는 `skillsRoot` 사용) */
  prepareRun(runId: string, skillIds: string[]): RunSkillBundle | undefined {
    if (skillIds.length === 0) return undefined;
    const pluginRoot = join(this.runRoot, runId);
    const skillsRoot = join(pluginRoot, "skills");
    rmSync(pluginRoot, { recursive: true, force: true });
    mkdirSync(join(pluginRoot, ".claude-plugin"), { recursive: true });
    writeFileSync(
      join(pluginRoot, ".claude-plugin", "plugin.json"),
      `${JSON.stringify({ name: LIBRARY_PLUGIN_NAME, version: "1.0.0", description: "AI Pixel Office skills" }, null, 2)}\n`,
    );
    for (const id of skillIds) {
      if (!this.has(id)) throw new DomainError("SKILLS_NOT_FOUND", `Skill not found: ${id}`, 422);
      cpSync(join(this.skillsRoot, id), join(skillsRoot, id), { recursive: true });
    }
    return { pluginRoot, skillsRoot, skillIds };
  }

  releaseRun(runId: string): void {
    rmSync(join(this.runRoot, runId), { recursive: true, force: true });
  }

  /** 라이브러리 전체 삭제 */
  clear(): void {
    rmSync(this.root, { recursive: true, force: true });
    mkdirSync(this.skillsRoot, { recursive: true });
  }

  private readSkillFile(id: string): { attributes: Record<string, string>; body: string } {
    return parseFrontmatter(readFileSync(join(this.skillsRoot, id, SKILL_FILE), "utf8"));
  }

  private readSummary(id: string): Skill | undefined {
    const directory = join(this.skillsRoot, id);
    const skillFile = join(directory, SKILL_FILE);
    if (!existsSync(skillFile)) return undefined;
    const { attributes } = this.readSkillFile(id);
    const metadata = readMetadata(directory);
    return {
      id,
      name: metadata.title ?? attributes.name ?? id,
      description: attributes.description ?? "",
      category: metadata.category ?? "기타",
      source: metadata.source ?? "imported",
      ...(metadata.version ? { version: metadata.version } : {}),
      ...(metadata.teamId ? { teamId: metadata.teamId } : {}),
      requiredPermissions: metadata.requiredPermissions ?? [],
      files: listFiles(directory).filter((path) => path !== SKILL_FILE && path !== METADATA_FILE),
      updatedAt: metadata.updatedAt ?? statSync(skillFile).mtime.toISOString(),
    };
  }

  private uniqueId(base: string): string {
    let id = base;
    while (this.has(id)) id = `${base.slice(0, 55)}-${randomBytes(3).toString("hex")}`;
    return id;
  }
}

export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || `skill-${randomBytes(3).toString("hex")}`;
}

export function parseFrontmatter(text: string): {
  attributes: Record<string, string>;
  body: string;
} {
  const normalized = text.replace(/^FEFF/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(normalized);
  if (!match) return { attributes: {}, body: normalized.trim() };
  const attributes: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0 || /^\s/.test(line)) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    attributes[key] = unquote(raw);
  }
  return { attributes, body: normalized.slice(match[0].length).trim() };
}

function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

function renderSkillFile(id: string, description: string, instructions: string): string {
  return `---\nname: ${id}\ndescription: ${JSON.stringify(description.replace(/\s+/g, " ").trim())}\n---\n\n${instructions.trim()}\n`;
}

function readMetadata(directory: string): SkillMetadata {
  try {
    return JSON.parse(readFileSync(join(directory, METADATA_FILE), "utf8")) as SkillMetadata;
  } catch {
    return {};
  }
}

function writeMetadata(directory: string, metadata: SkillMetadata): void {
  writeFileSync(join(directory, METADATA_FILE), `${JSON.stringify(metadata, null, 2)}\n`);
}

function listFiles(directory: string): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(relative(directory, path).split(sep).join("/"));
    }
  };
  walk(directory);
  return files.sort();
}
