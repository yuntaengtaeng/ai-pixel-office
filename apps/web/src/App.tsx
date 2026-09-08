import { mediaQuery } from "@ai-pixel-office/design-system";
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import styled from "styled-components";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { systemApi } from "./features/system/api.ts";
import { workspaceApi } from "./features/workspaces/api.ts";
import { TaskNotifications } from "./features/notifications/TaskNotifications.tsx";
import { useLiveUpdates } from "./shared/hooks/useLiveUpdates.ts";
import { messageOf } from "./shared/lib/errors.ts";
import { PageLoading } from "./shared/ui/PageLoading.tsx";
import { Sidebar } from "./shared/ui/Sidebar.tsx";
import { agentApi } from "./features/agents/api.ts";
import { CommuteSplash } from "./features/splash/components/CommuteSplash.tsx";
import { OnboardingFlow } from "./features/onboarding/OnboardingFlow.tsx";
import { isWorkspaceReady } from "./features/onboarding/readiness.ts";

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
  if (workspace.isPending) return <CommuteSplash message="오피스를 여는 중이에요." />;
  if (workspace.isError || !workspace.data)
    return (
      <CommuteSplash
        message=""
        error={messageOf(workspace.error)}
        onRetry={() => void workspace.refetch()}
      />
    );
  return <WorkspaceGate workspace={workspace.data} />;
}

function WorkspaceGate({ workspace }: { workspace: Workspace }) {
  const runtimeStatus = useQuery({
    queryKey: ["system-status"],
    queryFn: systemApi.status,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  if (runtimeStatus.isPending || agents.isPending)
    return <CommuteSplash message="AI 연결과 출근 가능한 동료를 확인하는 중이에요." />;
  if (runtimeStatus.isError || agents.isError || !runtimeStatus.data)
    return (
      <CommuteSplash
        message=""
        error={messageOf(runtimeStatus.error ?? agents.error)}
        onRetry={() => {
          void runtimeStatus.refetch();
          void agents.refetch();
        }}
      />
    );
  // 독립된 인증과 Agent 존재 여부가 아니라 서로 호환되는 실행 가능 조합을 기준으로 분기
  const ready = isWorkspaceReady(agents.data, runtimeStatus.data);
  return (
    <ReadyWorkspace
      workspace={workspace}
      runtimeStatus={runtimeStatus.data}
      agents={agents.data ?? []}
      ready={ready}
      onRefresh={runtimeStatus.refetch}
    />
  );
}

function ReadyWorkspace({
  workspace,
  runtimeStatus,
  agents,
  ready,
  onRefresh,
}: {
  workspace: Workspace;
  runtimeStatus: Awaited<ReturnType<typeof systemApi.status>>;
  agents: Awaited<ReturnType<typeof agentApi.list>>;
  ready: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const manualConfigKey = `manual-config:${workspace.id}`;
  const onboardingProgressKey = `onboarding-in-progress:${workspace.id}`;
  // 직접 구성 선택은 재시작 뒤에도 존중하되 진행 중 이탈 기록은 readiness보다 우선해 재개
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      // 설정 도중 이탈한 경우 readiness가 먼저 충족돼도 남은 단계부터 재개
      if (localStorage.getItem(onboardingProgressKey) === "true") return true;
      if (ready) return false;
      return localStorage.getItem(manualConfigKey) !== "true";
    } catch {
      return !ready;
    }
  });
  const [onboardingSkipped, setOnboardingSkipped] = useState(() => {
    try {
      return localStorage.getItem(manualConfigKey) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!showOnboarding) return;
    try {
      localStorage.setItem(onboardingProgressKey, "true");
    } catch {
      // Storage가 제한된 환경에서는 현재 앱 실행의 온보딩 상태만 유지
    }
  }, [onboardingProgressKey, showOnboarding]);
  const finishOnboarding = (taskId?: string) => {
    try {
      localStorage.removeItem(manualConfigKey);
      localStorage.removeItem(onboardingProgressKey);
    } catch {
      // Storage가 제한된 환경에서도 현재 앱 실행에서는 dashboard 이동을 허용한다.
    }
    setOnboardingSkipped(false);
    setShowOnboarding(false);
    // 생성 단계를 다시 실행하지 않도록 첫 Task session으로 history를 교체한다.
    navigate(taskId ? `/tasks/${taskId}` : "/", { replace: true });
  };
  const skipOnboarding = () => {
    try {
      localStorage.setItem(manualConfigKey, "true");
      localStorage.removeItem(onboardingProgressKey);
    } catch {
      // Storage가 제한된 환경에서도 현재 앱 실행에서는 직접 구성 선택 유지
    }
    setOnboardingSkipped(true);
    setShowOnboarding(false);
    navigate("/");
  };
  const resumeOnboarding = () => {
    // 사용자가 명시적으로 재개하면 이전의 직접 구성 선택을 제거해 다음 실행에서도 흐름 유지
    try {
      localStorage.removeItem(manualConfigKey);
      localStorage.setItem(onboardingProgressKey, "true");
    } catch {
      // Storage가 제한되어도 현재 앱 실행의 재진입은 계속한다.
    }
    setOnboardingSkipped(false);
    setShowOnboarding(true);
  };
  if (showOnboarding)
    return (
      <OnboardingFlow
        workspace={workspace}
        status={runtimeStatus}
        agents={agents}
        onComplete={finishOnboarding}
        onSkip={skipOnboarding}
        onRefresh={onRefresh}
      />
    );
  return (
    <AppShell
      workspace={workspace}
      runtimeStatus={runtimeStatus}
      ready={ready}
      showSetupNotice={!ready || onboardingSkipped}
      onResumeOnboarding={resumeOnboarding}
    />
  );
}

function AppShell({
  workspace,
  runtimeStatus,
  ready,
  showSetupNotice,
  onResumeOnboarding,
}: {
  workspace: Workspace;
  runtimeStatus: Awaited<ReturnType<typeof systemApi.status>>;
  ready: boolean;
  showSetupNotice: boolean;
  onResumeOnboarding: () => void;
}) {
  useLiveUpdates(workspace.id);
  return (
    <Styled.Shell>
      <ScrollToTop />
      <TaskNotifications workspaceId={workspace.id} />
      <Sidebar workspace={workspace} runtimeStatus={runtimeStatus} />
      <Styled.Content>
        <Suspense fallback={<PageLoading>화면을 준비하는 중...</PageLoading>}>
          <Routes>
            <Route
              path="/"
              element={
                <TodayPage
                  workspace={workspace}
                  readiness={{ ready, showSetupNotice, onResumeOnboarding }}
                />
              }
            />
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
