import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * 앱이 함께 배포하는 Product Team 패키지의 스킬 폴더를 이 팀의 범용 스킬 원본에서 생성
 *
 * --check 사용 시 파일을 바꾸지 않고 원본과 다른 스킬만 출력하고 실패 코드로 종료
 */
const teamRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(teamRoot, "..", "..");
const bundleSkillsRoot = join(projectRoot, "apps", "server", "resources", "teams", "product-team", "skills");
const checkOnly = process.argv.includes("--check");

const APP_BUNDLE_SKILLS = [
  "ux/product-context-discovery",
  "ux/user-flow-modeling",
  "ux/interaction-state-spec",
  "ux/usability-review",
  "ui/design-system-discovery",
  "ui/screen-component-spec",
  "workflow/handoff-validation",
  "workflow/conflict-reporting",
];

function skillText(path) {
  return readFileSync(join(path, "SKILL.md"), "utf8").replaceAll("\r\n", "\n");
}

const outdated = [];
if (!checkOnly) mkdirSync(bundleSkillsRoot, { recursive: true });
for (const source of APP_BUNDLE_SKILLS) {
  const sourcePath = join(teamRoot, "skills", source);
  const name = source.split("/").at(-1);
  const targetPath = join(bundleSkillsRoot, name);
  if (checkOnly) {
    if (!existsSync(join(targetPath, "SKILL.md")) || skillText(targetPath) !== skillText(sourcePath)) {
      outdated.push(name);
    }
    continue;
  }
  rmSync(targetPath, { recursive: true, force: true });
  cpSync(sourcePath, targetPath, { recursive: true });
}

if (checkOnly && outdated.length > 0) {
  process.stderr.write(`App bundle skills differ from source: ${outdated.join(", ")}\n`);
  process.exit(1);
}
const summary = checkOnly
  ? "App bundle skills are up to date"
  : `Copied ${APP_BUNDLE_SKILLS.length} skills`;
process.stdout.write(`${summary}\n`);
