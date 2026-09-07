import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * 팀 Skill 원본을 현재 AI Pixel Office 저장소의 Codex 및 Claude 탐색 경로에 안전하게 연결
 *
 * 같은 이름의 사용자 Skill은 덮어쓰지 않고 marker가 있는 팀 소유 디렉터리만 동기화
 * --check 사용 시 파일을 변경하지 않고 설치 누락과 원본 차이만 검사
 */
const teamRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(teamRoot, "..", "..");
const markerName = ".pixel-office-product-team";
const checkOnly = process.argv.includes("--check");

function skillDirectories(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (!statSync(path).isDirectory()) return [];
    if (existsSync(join(path, "SKILL.md"))) return [path];
    return skillDirectories(path);
  });
}

function normalizedSkill(path) {
  return readFileSync(join(path, "SKILL.md"), "utf8").replaceAll("\r\n", "\n");
}

const sourceSkills = skillDirectories(join(teamRoot, "skills"));
const targets = [join(projectRoot, ".agents", "skills"), join(projectRoot, ".claude", "skills")];
const failures = [];

for (const targetRoot of targets) {
  if (!checkOnly) mkdirSync(targetRoot, { recursive: true });
  for (const source of sourceSkills) {
    const name = source.split(/[\\/]/).at(-1);
    const target = join(targetRoot, name);
    const marker = join(target, markerName);

    if (existsSync(target) && !existsSync(marker)) {
      failures.push(`existing unmanaged skill: ${relative(projectRoot, target)}`);
      continue;
    }

    if (checkOnly) {
      if (!existsSync(join(target, "SKILL.md"))) {
        failures.push(`missing skill: ${relative(projectRoot, target)}`);
      } else if (normalizedSkill(source) !== normalizedSkill(target)) {
        failures.push(`outdated skill: ${relative(projectRoot, target)}`);
      }
      continue;
    }

    const staging = join(targetRoot, `.${name}.pixel-office-product-team.tmp`);
    try {
      rmSync(staging, { recursive: true, force: true });
      cpSync(source, staging, { recursive: true });
      writeFileSync(
        join(staging, markerName),
        "Managed by ai-docs/pixel-office-product-team\n",
        "utf8",
      );
      if (existsSync(target)) rmSync(target, { recursive: true, force: true });
      renameSync(staging, target);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(checkOnly ? "Project connection is current\n" : "Connected team skills\n");
}
