import { lazy, Suspense, useEffect } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Workspace } from "../../../packages/domain/src/entities.ts";
import { systemApi } from "./features/system/api.ts";
import { workspaceApi } from "./features/workspaces/api.ts";
import { TaskNotifications } from "./features/notifications/TaskNotifications.tsx";
import { messageOf } from "./shared/lib/errors.ts";
import { FullScreenMessage } from "./shared/ui/common.tsx";

const TodayPage = lazy(() =>
  import("./features/dashboard/TodayPage.tsx").then((module) => ({ default: module.TodayPage })),
);
const ProjectsPage = lazy(() =>
  import("./features/projects/ProjectPages.tsx").then((module) => ({
    default: module.ProjectsPage,
  })),
);
const ProjectDetailPage = lazy(() =>
  import("./features/projects/ProjectPages.tsx").then((module) => ({
    default: module.ProjectDetailPage,
  })),
);
const AgentsPage = lazy(() =>
  import("./features/agents/AgentPages.tsx").then((module) => ({ default: module.AgentsPage })),
);
const AgentDetailPage = lazy(() =>
  import("./features/agents/AgentPages.tsx").then((module) => ({
    default: module.AgentDetailPage,
  })),
);
const SkillsPage = lazy(() =>
  import("./features/skills/SkillsPage.tsx").then((module) => ({ default: module.SkillsPage })),
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage.tsx").then((module) => ({
    default: module.SettingsPage,
  })),
);
const TaskDetailPage = lazy(() =>
  import("./features/tasks/TaskDetailPage.tsx").then((module) => ({
    default: module.TaskDetailPage,
  })),
);

function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: async () => {
      const workspaces = await workspaceApi.list();
      return workspaces[0] ?? workspaceApi.create("나의 AI 오피스");
    },
    staleTime: Infinity,
  });
}

function useLiveUpdates(workspaceId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const stream = new EventSource(`/api/events?workspaceId=${encodeURIComponent(workspaceId)}`);
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["activities", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["task"] });
    };
    for (const event of [
      "task.status_changed",
      "task.result_updated",
      "agent.status_changed",
      "activity.created",
      "approval.requested",
      "run.progress",
    ])
      stream.addEventListener(event, refresh);
    return () => stream.close();
  }, [queryClient, workspaceId]);
}

export function App() {
  const workspace = useWorkspace();
  if (workspace.isPending) return <FullScreenMessage>오피스 문을 여는 중...</FullScreenMessage>;
  if (workspace.isError || !workspace.data)
    return <FullScreenMessage error>{messageOf(workspace.error)}</FullScreenMessage>;
  return <AppShell workspace={workspace.data} />;
}

function AppShell({ workspace }: { workspace: Workspace }) {
  useLiveUpdates(workspace.id);
  const runtimeStatus = useQuery({
    queryKey: ["system-status"],
    queryFn: systemApi.status,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return (
    <div className="app-shell">
      <ScrollToTop />
      <TaskNotifications workspaceId={workspace.id} />
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">AO</span>
          <span>AI Pixel Office</span>
        </Link>
        <div className="sidebar-runtimes" aria-label="실행 엔진 연결 상태">
          <span
            className={runtimeStatus.data?.codex.authenticated ? "connected" : ""}
            title={`Codex · ${runtimeStatus.data?.codex.detail ?? "확인 중"}`}
          >
            <b>C</b>Codex
          </span>
          <span
            className={runtimeStatus.data?.claude.authenticated ? "connected" : ""}
            title={`Claude · ${runtimeStatus.data?.claude.detail ?? "확인 중"}`}
          >
            <b>A</b>Claude
          </span>
        </div>
        <div className="workspace-chip">
          <span className="online-dot" />
          {workspace.name}
        </div>
        <nav>
          <NavLink to="/" end>
            <span>⌂</span> 사무실
          </NavLink>
          <NavLink to="/projects">
            <span>▦</span> 프로젝트
          </NavLink>
          <NavLink to="/agents">
            <span>♟</span> 에이전트
          </NavLink>
          <NavLink to="/skills">
            <span>✦</span> 스킬
          </NavLink>
          <NavLink to="/settings">
            <span>⚙</span> 설정
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <strong>LOCAL FIRST</strong>
          <span>내 컴퓨터에서 안전하게 실행됩니다.</span>
        </div>
      </aside>
      <main className="main-content">
        <Suspense fallback={<div className="page-loading">화면을 준비하는 중...</div>}>
          <Routes>
            <Route path="/" element={<TodayPage workspace={workspace} />} />
            <Route path="/projects" element={<ProjectsPage workspace={workspace} />} />
            <Route path="/projects/:id" element={<ProjectDetailPage workspace={workspace} />} />
            <Route path="/agents" element={<AgentsPage workspace={workspace} />} />
            <Route path="/agents/:id" element={<AgentDetailPage workspace={workspace} />} />
            <Route path="/skills" element={<SkillsPage workspace={workspace} />} />
            <Route path="/settings" element={<SettingsPage workspace={workspace} />} />
            <Route path="/tasks/:id" element={<TaskDetailPage workspace={workspace} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}
