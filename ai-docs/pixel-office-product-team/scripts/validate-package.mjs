import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * 로컬 팀 템플릿의 필수 파일과 Skill frontmatter를 빠르게 검증
 *
 * team.yaml이 Community 공식 package schema를 만족하는지는 검증하지 않으며 행동 품질은 Eval이 담당
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "team.yaml",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "agents/ux-designer.md",
  "agents/ui-designer.md",
  "agents/fullstack-developer.md",
  "instructions/handoff-contract.md",
  "instructions/collaboration-records.md",
];

const failures = required.filter((path) => !existsSync(join(root, path)));
const manifest = readFileSync(join(root, "team.yaml"), "utf8");
for (const value of [
  "pixel-office-product-team",
  "local-team-v1",
  "ux-designer",
  "ui-designer",
  "fullstack-developer",
]) {
  if (!manifest.includes(value)) failures.push(`team.yaml missing ${value}`);
}

function skillFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? skillFiles(path) : name === "SKILL.md" ? [path] : [];
  });
}

for (const path of skillFiles(join(root, "skills"))) {
  const content = readFileSync(path, "utf8");
  if (
    !content.startsWith("---\n") ||
    !content.includes("\nname:") ||
    !content.includes("\ndescription:")
  ) {
    failures.push(`invalid skill frontmatter: ${path}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Package structure is valid\n");
}
