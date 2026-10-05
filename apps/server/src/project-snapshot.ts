import { copyFile, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { DomainError } from "@ai-pixel-office/domain";
import { runGit } from "./git.ts";

export type ProjectLocation = {
  /** 저장소 루트의 실제 경로 */
  repositoryRoot: string;
  /** 저장소 루트 기준 프로젝트 경로 (POSIX 구분자, 루트 자체면 빈 문자열) */
  scope: string;
};

export type ProjectFileChange = {
  status: "added" | "modified" | "deleted";
  /** 저장소 루트 기준 경로(POSIX 구분자) */
  path: string;
};

/**
 * 프로젝트 폴더가 속한 Git 저장소 조회
 * Git 저장소가 아니거나 Git이 설치되지 않았으면 undefined, 그 밖의 Git 오류(소유자 확인 거부 등)는 예외
 */
export async function locateProjectRepository(
  projectPath: string,
): Promise<ProjectLocation | undefined> {
  let projectRealPath: string;
  try {
    projectRealPath = await realpath(projectPath);
  } catch {
    return undefined;
  }
  let topLevel: string;
  try {
    topLevel = (await runGit(projectRealPath, ["rev-parse", "--show-toplevel"])).trim();
  } catch (error) {
    if (isNotRepositoryError(error)) return undefined;
    throw new DomainError(
      "GIT_UNAVAILABLE",
      `프로젝트 폴더의 Git 정보를 읽지 못했어요: ${gitErrorText(error)}`,
      422,
    );
  }
  if (!topLevel) return undefined;
  const repositoryRoot = await realpath(topLevel);
  const scope = relative(repositoryRoot, projectRealPath).split(sep).join("/");
  if (scope.startsWith("..") || isAbsolute(scope)) return undefined;
  return { repositoryRoot, scope };
}

/** Git이 없거나 Git 저장소가 아니라서 실패했는지 */
function isNotRepositoryError(error: unknown): boolean {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
  return /not a git repository/i.test(gitErrorText(error));
}

export function gitErrorText(error: unknown): string {
  const stderr = (error as { stderr?: unknown }).stderr;
  if (typeof stderr === "string" && stderr.trim()) return stderr.trim();
  return error instanceof Error ? error.message : String(error);
}

/**
 * 프로젝트 폴더의 현재 파일 상태를 tree로 기록
 * 커밋 안 된 수정과 추적 안 된 파일을 포함하고 .gitignore 대상은 제외, 사용자 index와 HEAD는 그대로
 */
export async function captureProjectSnapshot(location: ProjectLocation): Promise<string> {
  const tempDirectory = await mkdtemp(join(tmpdir(), "pixel-office-snapshot-"));
  const indexFile = join(tempDirectory, "index");
  try {
    const userIndex = resolve(
      location.repositoryRoot,
      (await runGit(location.repositoryRoot, ["rev-parse", "--git-path", "index"])).trim(),
    );
    await copyFile(userIndex, indexFile).catch(() => undefined);
    const env = { GIT_INDEX_FILE: indexFile };
    await runGit(location.repositoryRoot, ["add", "--all", "--", scopePathspec(location)], env);
    return (await runGit(location.repositoryRoot, ["write-tree"], env)).trim();
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

/** 두 tree 사이에서 프로젝트 폴더 안의 바뀐 파일 */
export async function diffProjectSnapshots(
  location: ProjectLocation,
  fromTree: string,
  toTree: string,
): Promise<ProjectFileChange[]> {
  const output = await runGit(location.repositoryRoot, [
    "diff",
    "--name-status",
    "--no-renames",
    "-z",
    fromTree,
    toTree,
    "--",
    scopePathspec(location),
  ]);
  return parseNameStatus(output);
}

/** `git diff --name-status -z` 출력 해석 */
export function parseNameStatus(output: string): ProjectFileChange[] {
  const fields = output.split("\0");
  const changes: ProjectFileChange[] = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const code = fields[index];
    const path = fields[index + 1];
    if (!code || !path) continue;
    const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified";
    changes.push({ status, path });
  }
  return changes;
}

/** 프로젝트 폴더만 가리키는 pathspec (저장소 루트면 전체) */
export function scopePathspec(location: Pick<ProjectLocation, "scope">): string {
  return location.scope ? `:(top,literal)${location.scope}` : ":(top)";
}

/** 저장소 기준 경로가 프로젝트 폴더 안에 있는지 */
export function isInsideScope(path: string, scope: string): boolean {
  return !scope || path === scope || path.startsWith(`${scope}/`);
}
