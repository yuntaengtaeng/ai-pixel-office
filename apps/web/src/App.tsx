import { mediaQuery } from "@ai-pixel-office/design-system";
import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import styled from "styled-components";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { systemApi } from "./features/system/api.ts";
import { workspaceApi } from "./features/workspaces/api.ts";
import { TaskNotifications } from "./features/notifications/TaskNotifications.tsx";
import { useLiveUpdates } from "./shared/hooks/useLiveUpdates.ts";
import { messageOf } from "./shared/lib/errors.ts";
import { FullScreenMessage } from "./shared/ui/FullScreenMessage.tsx";
import { PageLoading } from "./shared/ui/PageLoading.tsx";
import { Sidebar } from "./shared/ui/Sidebar.tsx";

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
const RecordsPage = lazy(() =>
  import("./features/records/RecordsPage.tsx").then((module) => ({ default: module.RecordsPage })),
);
const PerformancePage = lazy(() =>
  import("./features/performance/PerformancePage.tsx").then((module) => ({
    default: module.PerformancePage,
  })),
);
const ChatPage = lazy(() =>
  import("./features/chat/ChatPage.tsx").then((module) => ({ default: module.ChatPage })),
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

const Styled = {
  Shell: styled.div`
    min-height: 100vh;
    display: grid;
    grid-template-columns: 228px minmax(0, 1fr);

    @media ${mediaQuery.md} {
      display: block;
    }
  `,
  Content: styled.main`
    grid-column: 2;
    min-width: 0;
  `,
};

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
    <Styled.Shell>
      <ScrollToTop />
      <TaskNotifications workspaceId={workspace.id} />
      <Sidebar workspace={workspace} runtimeStatus={runtimeStatus.data} />
      <Styled.Content>
        <Suspense fallback={<PageLoading>화면을 준비하는 중...</PageLoading>}>
          <Routes>
            <Route path="/" element={<TodayPage workspace={workspace} />} />
            <Route path="/projects" element={<ProjectsPage workspace={workspace} />} />
            <Route path="/projects/:id" element={<ProjectDetailPage workspace={workspace} />} />
            <Route path="/agents" element={<AgentsPage workspace={workspace} />} />
            <Route path="/agents/:id" element={<AgentDetailPage workspace={workspace} />} />
            <Route path="/skills" element={<SkillsPage workspace={workspace} />} />
            <Route path="/records" element={<RecordsPage workspace={workspace} />} />
            <Route path="/performance" element={<PerformancePage workspace={workspace} />} />
            <Route path="/chat" element={<ChatPage workspace={workspace} />} />
            <Route path="/chat/:taskId" element={<ChatPage workspace={workspace} />} />
            <Route path="/settings" element={<SettingsPage workspace={workspace} />} />
            <Route path="/tasks/:id" element={<TaskDetailPage workspace={workspace} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Styled.Content>
    </Styled.Shell>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}
