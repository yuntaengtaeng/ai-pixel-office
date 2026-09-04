import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AgentModel } from "../../../packages/domain/src/index.ts";

export type DetectedProjectSkill = {
  name: string;
  path: string;
};

export type ProjectRuntimeContext = {
  runtime: AgentModel;
  workingDirectory: string;
  instructionFiles: string[];
  projectSkills: DetectedProjectSkill[];
};

export function inspectProjectRuntimeContext(
  runtime: AgentModel,
  workingDirectory: string,
): ProjectRuntimeContext {
  const directory = resolve(workingDirectory);
  const chain = projectDirectoryChain(directory);
  const instructionFiles = chain.flatMap((entry) => instructionFilesIn(runtime, entry));
  const projectSkills = chain.flatMap((entry) => skillsIn(runtime, entry));
  return { runtime, workingDirectory: directory, instructionFiles, projectSkills };
}

function projectDirectoryChain(workingDirectory: string): string[] {
  const ancestors: string[] = [];
  let current = workingDirectory;
  while (true) {
    ancestors.push(current);
    if (existsSync(join(current, ".git"))) return ancestors.reverse();
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return [workingDirectory];
}

function instructionFilesIn(runtime: AgentModel, directory: string): string[] {
  if (runtime === "codex") {
    const override = join(directory, "AGENTS.override.md");
    if (isFile(override)) return [override];
    const standard = join(directory, "AGENTS.md");
    return isFile(standard) ? [standard] : [];
  }

  return [
    join(directory, "CLAUDE.md"),
    join(directory, ".claude", "CLAUDE.md"),
    join(directory, "CLAUDE.local.md"),
  ].filter(isFile);
}

function skillsIn(runtime: AgentModel, directory: string): DetectedProjectSkill[] {
  const root = join(directory, runtime === "codex" ? ".agents" : ".claude", "skills");
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isFile(join(root, entry.name, "SKILL.md")))
      .map((entry) => ({ name: entry.name, path: join(root, entry.name, "SKILL.md") }));
  } catch {
    return [];
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
