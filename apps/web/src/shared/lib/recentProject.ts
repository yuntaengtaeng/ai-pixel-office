const GENERAL_SCOPE = "general";

const storageKey = (workspaceId: string) => `recent-project:${workspaceId}`;

/** 마지막으로 생성에 성공한 Task의 프로젝트 선택 조회 */
export function recentProjectId(workspaceId: string): string | null {
  const value = localStorage.getItem(storageKey(workspaceId));
  if (value === null) return null;
  return value === GENERAL_SCOPE ? "" : value;
}

/** 실제 Task 생성에 성공한 뒤에만 다음 Composer의 제안값 갱신 */
export function rememberProject(workspaceId: string, projectId?: string): void {
  localStorage.setItem(storageKey(workspaceId), projectId || GENERAL_SCOPE);
}
