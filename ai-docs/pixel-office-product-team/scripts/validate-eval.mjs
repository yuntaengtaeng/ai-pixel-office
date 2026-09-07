import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Eval Task와 rubric 연결 및 행동 기준의 필수 구성을 검증
 *
 * Agent 응답을 실행하거나 자동 채점하지 않으며 실제 결과 평가는 eval/README.md 절차를 사용
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const taskRoot = join(root, "eval", "tasks");
const failures = [];

function files(directory, suffix) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path, suffix) : path.endsWith(suffix) ? [path] : [];
  });
}

for (const task of files(taskRoot, ".md")) {
  const content = readFileSync(task, "utf8");
  const rubric = content.match(/^rubric: ([a-z-]+)$/m)?.[1];
  for (const field of ["id", "agent", "rubric"]) {
    if (!new RegExp(`^${field}:`, "m").test(content)) failures.push(`${task} missing ${field}`);
  }
  if (!rubric || !existsSync(join(root, "eval", "rubrics", `${rubric}.yaml`))) {
    failures.push(`${task} references missing rubric`);
  }
}

for (const rubric of files(join(root, "eval", "rubrics"), ".yaml")) {
  const content = readFileSync(rubric, "utf8");
  if (!content.includes("must_include:") || !content.includes("must_not:")) {
    failures.push(`${rubric} missing behavioral criteria`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Eval structure is valid\n");
}
