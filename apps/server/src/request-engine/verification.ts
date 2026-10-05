/**
 * 실행한 셸 명령이 프로젝트 확인 방법 중 하나인지 판단
 * `cd x && pnpm test`처럼 이어진 명령은 마지막 명령으로 보고, `pnpm run test`와 `pnpm test`는 같게 봄
 * 확인 방법에 없는 명령은 검증으로 세지 않음
 */
export function matchVerificationCommand(
  executed: string,
  verificationCommands: string[],
): string | undefined {
  const executedKey = commandKey(lastCommand(executed));
  if (!executedKey) return undefined;
  return verificationCommands.find((command) => commandKey(command) === executedKey);
}

function lastCommand(command: string): string {
  const parts = command.split(/&&|;|\|\|/);
  return parts[parts.length - 1] ?? "";
}

const RUN_ALIASES = new Set(["pnpm", "npm", "yarn", "bun"]);

function commandKey(command: string): string {
  const words = command.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3 && RUN_ALIASES.has(words[0]!) && words[1] === "run") words.splice(1, 1);
  return words.join(" ");
}

export type PackageScripts = Record<string, string>;

const VERIFICATION_SCRIPT_NAMES = ["typecheck", "check", "lint", "test", "build"] as const;

/** package.json script에서 확인 방법 후보 제안 (lockfile로 패키지 관리자 결정) */
export function suggestVerificationCommands(
  scripts: PackageScripts,
  packageManager: "pnpm" | "npm" | "yarn" | "bun",
): string[] {
  return VERIFICATION_SCRIPT_NAMES.filter((name) => typeof scripts[name] === "string").map(
    (name) =>
      packageManager === "npm" && name !== "test" ? `npm run ${name}` : `${packageManager} ${name}`,
  );
}

/** lockfile 이름으로 패키지 관리자와 작업 공간 준비 명령 결정 */
export function detectPackageManager(
  fileNames: string[],
): { packageManager: "pnpm" | "npm" | "yarn" | "bun"; setupCommand: string } | undefined {
  const names = new Set(fileNames);
  if (names.has("pnpm-lock.yaml"))
    return { packageManager: "pnpm", setupCommand: "pnpm install --frozen-lockfile" };
  if (names.has("bun.lockb") || names.has("bun.lock"))
    return { packageManager: "bun", setupCommand: "bun install --frozen-lockfile" };
  if (names.has("yarn.lock"))
    return { packageManager: "yarn", setupCommand: "yarn install --frozen-lockfile" };
  if (names.has("package-lock.json")) return { packageManager: "npm", setupCommand: "npm ci" };
  if (names.has("package.json")) return { packageManager: "npm", setupCommand: "npm install" };
  return undefined;
}

export type ExecutedCommand = { command: string; succeeded: boolean };

/** 실행한 명령 중 확인 방법에 해당하는 것의 결과 (같은 확인을 여러 번 했으면 마지막 결과) */
export function verificationFacts(
  executed: ExecutedCommand[],
  verificationCommands: string[],
): Array<{ command: string; passed: boolean }> {
  const latest = new Map<string, boolean>();
  for (const run of executed) {
    const matched = matchVerificationCommand(run.command, verificationCommands);
    if (matched) {
      latest.delete(matched);
      latest.set(matched, run.succeeded);
    }
  }
  return [...latest].map(([command, passed]) => ({ command, passed }));
}
