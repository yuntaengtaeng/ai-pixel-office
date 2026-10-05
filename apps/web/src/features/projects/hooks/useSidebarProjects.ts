import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { taskApi } from "../../tasks/api.ts";
import { projectApi } from "../api.ts";
import { REQUEST_STATE } from "../../../shared/config/presentation.ts";
import { requestStateOf } from "../../tasks/utils/requestState.ts";
import type { SidebarTreeItem } from "../../../shared/ui/AppSidebar.tsx";
import { currentProjectIdOf, sidebarProjects } from "../utils/sidebarProjects.ts";

const SIDEBAR_REQUEST_LIMIT = 5;

/** 사이드바에 표시할 프로젝트와 현재 프로젝트의 진행 중인 기안서 */
export function useSidebarProjects(workspaceId: string): SidebarTreeItem[] {
  const { pathname } = useLocation();
  const projects = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => projectApi.list(workspaceId),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspaceId],
    queryFn: () => taskApi.list(workspaceId),
  });
  const taskList = tasks.data ?? [];
  return sidebarProjects(
    projects.data ?? [],
    taskList,
    currentProjectIdOf(pathname, taskList),
    SIDEBAR_REQUEST_LIMIT,
  ).map(({ project, requests }) => ({
    to: `/projects/${project.id}`,
    label: project.name,
    busy: taskList.some((task) => task.projectId === project.id && task.status === "working"),
    children: requests.map((task) => {
      const state = REQUEST_STATE[requestStateOf(task)];
      return { to: `/tasks/${task.id}`, label: task.title, color: state.color, title: state.label };
    }),
  }));
}
