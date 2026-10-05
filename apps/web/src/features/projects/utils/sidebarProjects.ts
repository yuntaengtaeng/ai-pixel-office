import type { Project, Task } from "@ai-pixel-office/domain/entities";
import { activeRequestsForSidebar } from "../../tasks/utils/requestBoard.ts";

export type SidebarProjectEntry = { project: Project; requests: Task[] };

/** 지금 보고 있는 프로젝트 (프로젝트 화면이거나 그 프로젝트의 기안서 화면) */
export function currentProjectIdOf(pathname: string, tasks: Task[]): string | undefined {
  const [, section, id] = pathname.split("/");
  if (section === "projects" && id) return id;
  if (section === "tasks" && id) return tasks.find((task) => task.id === id)?.projectId;
  return undefined;
}

/** 사이드바 프로젝트 목록 (완료된 프로젝트 제외, 이름순, 현재 프로젝트만 진행 중인 기안서를 펼침) */
export function sidebarProjects(
  projects: Project[],
  tasks: Task[],
  currentProjectId: string | undefined,
  requestLimit: number,
): SidebarProjectEntry[] {
  return projects
    .filter((project) => project.status !== "done" || project.id === currentProjectId)
    .sort((left, right) => left.name.localeCompare(right.name, "ko"))
    .map((project) => ({
      project,
      requests:
        project.id === currentProjectId
          ? activeRequestsForSidebar(
              tasks.filter((task) => task.projectId === project.id),
              requestLimit,
            )
          : [],
    }));
}
