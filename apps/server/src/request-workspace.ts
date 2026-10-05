import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { isDirectory, pathExists } from "./file-system.ts";
import { PIXEL_OFFICE_GIT_IDENTITY, runGit } from "./git.ts";
import {
  captureProjectSnapshot,
  gitErrorText,
  isInsideScope,
  parseNameStatus,
  scopePathspec,
  type ProjectFileChange,
  type ProjectLocation,
} from "./project-snapshot.ts";

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export type RequestWorkspaceAddress = {
  /** 사용자 프로젝트 폴더가 속한 저장소 */
  project: ProjectLocation;
  /** 앱 데이터 아래 작업 공간들을 두는 폴더 */
  workspacesRoot: string;
  projectId: string;
  taskId: string;
};

export type RequestWorkspace = RequestWorkspaceAddress & {
  /** 작업 공간 루트 (사용자 저장소 루트에 해당) */
  root: string;
  /** 동료가 실행되는 경로 (작업 공간 안의 프로젝트 폴더) */
  runDirectory: string;
  /** 비교 기준이 되는 시작점 커밋 */
  baseCommit: string;
};

export type RequestWorkspaceChanges = {
  /** 결재 때 사용자 프로젝트 폴더에 반영할 변경 */
  inside: ProjectFileChange[];
  /** 같은 저장소의 프로젝트 폴더 밖 변경 (반영하지 않음) */
  outside: ProjectFileChange[];
};

export type ApplyResult =
  | { status: "applied"; changes: ProjectFileChange[] }
  | { status: "empty" }
  | { status: "conflict"; detail: string };

export function requestWorkspacePath(
  workspacesRoot: string,
  projectId: string,
  taskId: string,
): string {
  return join(workspacesRoot, assertSafeId(projectId), assertSafeId(taskId));
}

/** 작업 공간 안에서 동료가 실행될 경로 (만들지 않고 계산만) */
export function requestWorkspaceRunDirectory(address: RequestWorkspaceAddress): string {
  return runDirectoryOf(
    requestWorkspacePath(address.workspacesRoot, address.projectId, address.taskId),
    address.project.scope,
  );
}

/** 작업 공간 시작점을 보존하는 참조 이름 */
export function requestBaseRef(taskId: string): string {
  return `refs/pixel-office/requests/${assertSafeId(taskId)}/base`;
}

/**
 * 사용자 폴더의 현재 상태(커밋하지 않은 변경 포함)를 시작점으로 작업 공간을 만듦
 * 사용자 index, HEAD, branch 목록은 바뀌지 않음
 */
export async function createRequestWorkspace(
  address: RequestWorkspaceAddress,
): Promise<RequestWorkspace> {
  const { project, taskId } = address;
  const root = requestWorkspacePath(address.workspacesRoot, address.projectId, taskId);
  const baseCommit = await commitTree(
    project.repositoryRoot,
    await captureProjectSnapshot(project),
    await readRef(project.repositoryRoot, "HEAD"),
    `Pixel Office request ${taskId}`,
  );
  await runGit(project.repositoryRoot, ["update-ref", requestBaseRef(taskId), baseCommit]);
  await mkdir(dirname(root), { recursive: true });
  // 폴더만 지워지고 등록이 남은 작업 공간이 있으면 같은 경로에 다시 만들 수 없음
  await runGit(project.repositoryRoot, ["worktree", "prune"]);
  await runGit(project.repositoryRoot, ["worktree", "add", "--detach", root, baseCommit]);
  return { ...address, root, runDirectory: runDirectoryOf(root, project.scope), baseCommit };
}

/** 이미 만든 작업 공간 열기 (시작점 참조나 폴더가 없으면 undefined) */
export async function openRequestWorkspace(
  address: RequestWorkspaceAddress,
): Promise<RequestWorkspace | undefined> {
  const root = requestWorkspacePath(address.workspacesRoot, address.projectId, address.taskId);
  const baseCommit = await readRef(address.project.repositoryRoot, requestBaseRef(address.taskId));
  if (!baseCommit || !(await isDirectory(root))) return undefined;
  return {
    ...address,
    root,
    runDirectory: runDirectoryOf(root, address.project.scope),
    baseCommit,
  };
}

/**
 * 작업 공간의 지금 상태를 새 시작점으로 삼음
 * 준비 명령이 만든 파일(예: 새로 생긴 lockfile)이 동료의 변경으로 잡히지 않게 함
 */
export async function refreshRequestBase(workspace: RequestWorkspace): Promise<RequestWorkspace> {
  const baseCommit = await commitTree(
    workspace.root,
    await captureProjectSnapshot({ repositoryRoot: workspace.root, scope: "" }),
    workspace.baseCommit,
    `Pixel Office request ${workspace.taskId} prepared`,
  );
  await runGit(workspace.project.repositoryRoot, [
    "update-ref",
    requestBaseRef(workspace.taskId),
    baseCommit,
  ]);
  return { ...workspace, baseCommit };
}

/** 시작점 이후 작업 공간에서 바뀐 파일 (무시된 파일 제외) */
export async function listRequestWorkspaceChanges(
  workspace: RequestWorkspace,
): Promise<RequestWorkspaceChanges> {
  const { changes } = await workspaceDiff(workspace);
  return splitByScope(changes, workspace.project.scope);
}

/** 화면에 보여줄 diff 최대 길이 (넘으면 잘라냄) */
const FILE_DIFF_LIMIT = 200_000;

/** 시작점 이후 작업 공간에서 파일 하나가 바뀐 내용 (unified diff, 바이너리는 바뀌었다는 표시만) */
export async function requestWorkspaceFileDiff(
  workspace: RequestWorkspace,
  path: string,
): Promise<string> {
  assertRelativeInside(path);
  const current = await captureProjectSnapshot({ repositoryRoot: workspace.root, scope: "" });
  const diff = await runGit(workspace.root, [
    "diff",
    "--no-renames",
    "--no-color",
    workspace.baseCommit,
    current,
    "--",
    path,
  ]);
  return diff.length > FILE_DIFF_LIMIT
    ? `${diff.slice(0, FILE_DIFF_LIMIT)}\n… (너무 길어 잘랐어요)`
    : diff;
}

export function splitByScope(changes: ProjectFileChange[], scope: string): RequestWorkspaceChanges {
  return {
    inside: changes.filter((change) => isInsideScope(change.path, scope)),
    outside: changes.filter((change) => !isInsideScope(change.path, scope)),
  };
}

/**
 * 작업 공간의 프로젝트 폴더 변경을 사용자 프로젝트 폴더에 커밋 없이 반영
 * 사용자 폴더가 그사이 같은 곳을 바꿨으면 아무것도 바꾸지 않고 conflict
 */
export async function applyRequestWorkspace(workspace: RequestWorkspace): Promise<ApplyResult> {
  const { project } = workspace;
  const { changes, patch } = await workspaceDiff(workspace, scopePathspec(project));
  if (changes.length === 0) return { status: "empty" };
  const tempDirectory = await mkdtemp(join(tmpdir(), "pixel-office-apply-"));
  const patchFile = join(tempDirectory, "request.patch");
  try {
    await writeFile(patchFile, patch);
    try {
      await runGit(project.repositoryRoot, ["apply", "--check", patchFile]);
    } catch (error) {
      return { status: "conflict", detail: gitErrorText(error) };
    }
    await runGit(project.repositoryRoot, ["apply", patchFile]);
    return { status: "applied", changes };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export type RealignResult = {
  /** 동료가 손으로 정리해야 하는 겹친 파일 (충돌 표시가 작업 공간 안에만 남음) */
  conflictedFiles: string[];
};

/**
 * 사용자 폴더의 지금 상태를 새 시작점으로 삼고, 동료의 변경을 그 위에 다시 얹음
 * 겹친 곳은 작업 공간 파일에만 충돌 표시로 남기고 사용자 폴더는 건드리지 않음
 */
export async function realignRequestWorkspace(workspace: RequestWorkspace): Promise<RealignResult> {
  const { project } = workspace;
  const { patch } = await workspaceDiff(workspace);
  const newBase = await commitTree(
    project.repositoryRoot,
    await captureProjectSnapshot(project),
    await readRef(project.repositoryRoot, "HEAD"),
    `Pixel Office request ${workspace.taskId} realigned`,
  );
  await runGit(workspace.root, ["checkout", "--force", "--detach", newBase]);
  await runGit(workspace.root, ["clean", "-fd"]);
  await runGit(project.repositoryRoot, ["update-ref", requestBaseRef(workspace.taskId), newBase]);
  if (!patch.trim()) return { conflictedFiles: [] };
  const tempDirectory = await mkdtemp(join(tmpdir(), "pixel-office-realign-"));
  const patchFile = join(tempDirectory, "request.patch");
  try {
    await writeFile(patchFile, patch);
    try {
      await runGit(workspace.root, ["apply", "--3way", patchFile]);
      return { conflictedFiles: [] };
    } catch {
      const unmerged = await runGit(workspace.root, ["diff", "--name-only", "--diff-filter=U"]);
      return { conflictedFiles: unmerged.split("\n").filter(Boolean) };
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

/** 작업 공간과 시작점 참조 삭제 (사용자 프로젝트 폴더는 그대로) */
export async function discardRequestWorkspace(address: RequestWorkspaceAddress): Promise<void> {
  const { project } = address;
  const root = requestWorkspacePath(address.workspacesRoot, address.projectId, address.taskId);
  await runGit(project.repositoryRoot, ["worktree", "remove", "--force", root]).catch(
    () => undefined,
  );
  await rm(root, { recursive: true, force: true });
  await runGit(project.repositoryRoot, ["worktree", "prune"]).catch(() => undefined);
  await runGit(project.repositoryRoot, ["update-ref", "-d", requestBaseRef(address.taskId)]).catch(
    () => undefined,
  );
}

/** 프로젝트 폴더의 무시된 파일을 작업 공간의 같은 위치로 복사 (예: `.env.local`) */
export async function copyIntoRequestWorkspace(
  workspace: RequestWorkspace,
  projectPath: string,
  relativePaths: string[],
): Promise<void> {
  for (const relativePath of relativePaths.map(assertRelativeInside)) {
    const source = join(projectPath, relativePath);
    if (!(await pathExists(source))) continue;
    await cp(source, join(workspace.runDirectory, relativePath), {
      recursive: true,
      force: true,
    });
  }
}

/** 프로젝트 폴더 기준 상대 경로만 허용 (절대 경로, 상위 폴더 이동 거부) */
export function assertRelativeInside(path: string): string {
  const normalized = normalize(path);
  if (
    !path.trim() ||
    isAbsolute(normalized) ||
    normalized === ".." ||
    normalized.startsWith(`..${sep}`)
  ) {
    throw new Error(`Path must stay inside the project folder: ${path}`);
  }
  return normalized;
}

/** 시작점과 작업 공간 지금 상태의 차이 (바뀐 파일 목록과 적용할 수 있는 patch) */
async function workspaceDiff(
  workspace: RequestWorkspace,
  pathspec?: string,
): Promise<{ changes: ProjectFileChange[]; patch: string }> {
  const current = await captureProjectSnapshot({ repositoryRoot: workspace.root, scope: "" });
  const range = [workspace.baseCommit, current, ...(pathspec ? ["--", pathspec] : [])];
  const changes = parseNameStatus(
    await runGit(workspace.root, ["diff", "--name-status", "--no-renames", "-z", ...range]),
  );
  const patch =
    changes.length > 0
      ? await runGit(workspace.root, ["diff", "--binary", "--no-renames", ...range])
      : "";
  return { changes, patch };
}

async function commitTree(
  repository: string,
  tree: string,
  parent: string | undefined,
  message: string,
): Promise<string> {
  const args = ["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", message];
  return (await runGit(repository, args, PIXEL_OFFICE_GIT_IDENTITY)).trim();
}

function runDirectoryOf(root: string, scope: string): string {
  return scope ? join(root, ...scope.split("/")) : root;
}

function assertSafeId(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error(`Invalid id for a request workspace: ${id}`);
  return id;
}

async function readRef(repositoryRoot: string, ref: string): Promise<string | undefined> {
  try {
    const value = (
      await runGit(repositoryRoot, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])
    ).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}
