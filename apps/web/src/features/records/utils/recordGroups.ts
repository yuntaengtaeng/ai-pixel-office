import type { KnowledgeDocument, Project, Task } from "@ai-pixel-office/domain/entities";

export type RecordGroup = { key: string; title: string; documents: KnowledgeDocument[] };

const NO_PROJECT_KEY = "no-project";
const WRITTEN_KEY = "written";

/** 문서가 나온 기안서들 (만든 기안서와 참고로 연결한 기안서) */
function taskIdsOf(document: KnowledgeDocument): string[] {
  return [...(document.taskId ? [document.taskId] : []), ...document.referenceTaskIds];
}

/** 제목이나 본문에 검색어가 들어간 문서 */
export function searchRecords(documents: KnowledgeDocument[], query: string): KnowledgeDocument[] {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  if (!normalized) return documents;
  return documents.filter((document) =>
    `${document.title} ${document.content}`.toLocaleLowerCase("ko-KR").includes(normalized),
  );
}

/** 한 프로젝트의 기안서에서 만들었거나 참고로 연결한 문서 */
export function recordsOfProject(
  documents: KnowledgeDocument[],
  tasks: Task[],
  projectId: string,
): KnowledgeDocument[] {
  const projectTaskIds = new Set(
    tasks.filter((task) => task.projectId === projectId).map((task) => task.id),
  );
  return documents.filter((document) =>
    taskIdsOf(document).some((taskId) => projectTaskIds.has(taskId)),
  );
}

/**
 * 문서를 프로젝트별로 묶음 (프로젝트 이름순, 그 다음 프로젝트 없는 기안서의 문서, 직접 쓴 문서)
 * 묶음 안에서는 최근에 고친 순
 */
export function groupRecordsByProject(
  documents: KnowledgeDocument[],
  tasks: Task[],
  projects: Project[],
): RecordGroup[] {
  const knownProjectIds = new Set(projects.map((project) => project.id));
  const projectIdOfTask = new Map(tasks.map((task) => [task.id, task.projectId]));
  const groupKeyOf = (document: KnowledgeDocument) => {
    const taskIds = taskIdsOf(document);
    if (taskIds.length === 0) return WRITTEN_KEY;
    const projectId = taskIds
      .map((taskId) => projectIdOfTask.get(taskId))
      .find((id) => id !== undefined && knownProjectIds.has(id));
    return projectId ?? NO_PROJECT_KEY;
  };
  const byKey = new Map<string, KnowledgeDocument[]>();
  const recentFirst = [...documents].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  for (const document of recentFirst) {
    const key = groupKeyOf(document);
    byKey.set(key, [...(byKey.get(key) ?? []), document]);
  }
  const projectGroups = [...projects]
    .sort((left, right) => left.name.localeCompare(right.name, "ko"))
    .map((project) => ({ key: project.id, title: project.name }));
  return [
    ...projectGroups,
    { key: NO_PROJECT_KEY, title: "프로젝트 없이 대화" },
    { key: WRITTEN_KEY, title: "직접 쓴 문서" },
  ].flatMap(({ key, title }) => {
    const grouped = byKey.get(key);
    return grouped ? [{ key, title, documents: grouped }] : [];
  });
}
