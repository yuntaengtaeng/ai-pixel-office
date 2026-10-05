import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { systemApi } from "./features/system/api.ts";
import { TaskNotifications } from "./features/notifications/TaskNotifications.tsx";
import { useLiveUpdates } from "./shared/hooks/useLiveUpdates.ts";
import { PageLoading } from "./shared/ui/PageLoading.tsx";
import { AppSidebar } from "./shared/ui/AppSidebar.tsx";
import { useDeskItems } from "./features/desk/hooks/useDeskItems.ts";
import { useSidebarProjects } from "./features/projects/hooks/useSidebarProjects.ts";
import { agentApi } from "./features/agents/api.ts";
import { CommuteSplash } from "./features/splash/components/CommuteSplash.tsx";
import { useBootData } from "./features/splash/hooks/useBootData.ts";
import { useSplashIntroPlaying } from "./features/splash/hooks/useSplashIntro.ts";
import { splashIntroMs } from "./features/splash/utils/splashTimeline.ts";
import { OnboardingFlow } from "./features/onboarding/OnboardingFlow.tsx";
import { isWorkspaceReady } from "./features/onboarding/readiness.ts";
import { LegacyResetNotice } from "./features/system/LegacyResetNotice.tsx";

const OfficeHomePage = lazy(() =>
  import("./features/office/OfficeHomePage.tsx").then((module) => ({
    default: module.OfficeHomePage,
  })),
);
const ProjectsPage = lazy(() =>
  import("./features/projects/ProjectsPage.tsx").then((module) => ({
    default: module.ProjectsPage,
  })),
);
const ProjectWorkspacePage = lazy(() =>
  import("./features/projects/ProjectWorkspacePage.tsx").then((module) => ({
    default: module.ProjectWorkspacePage,
  })),
);
const OrgChartPage = lazy(() =>
  import("./features/agents/OrgChartPage.tsx").then((module) => ({ default: module.OrgChartPage })),
);
const AgentDetailPage = lazy(() =>
  import("./features/agents/AgentDetailPage.tsx").then((module) => ({
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
const InboxPage = lazy(() =>
  import("./features/desk/InboxPage.tsx").then((module) => ({ default: module.InboxPage })),
);
const NewRequestPage = lazy(() =>
  import("./features/tasks/NewRequestPage.tsx").then((module) => ({
    default: module.NewRequestPage,
  })),
);
const TaskDetailPage = lazy(() =>
  import("./features/tasks/TaskDetailPage.tsx").then((module) => ({
    default: module.TaskDetailPage,
  })),
);

const Styled = {
  Shell: styled.div`
    min-height: 100vh;
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    @media ${({ theme }) => theme.mediaQuery.md} {
      display: block;
    }
  `,
  Content: styled.main`
    min-width: 0;
  `,
};

export function App() {
  const boot = useBootData();
  const introPlaying = useSplashIntroPlaying(splashIntroMs());
  if (boot.status === "error")
    return <CommuteSplash message="" error={boot.error} onRetry={boot.retry} />;
  if (boot.status === "loading" || introPlaying)
    return (
      <CommuteSplash
        message={boot.status === "loading" ? boot.message : "출근 완료! 오피스를 열어요."}
      />
    );
  // 독립된 인증과 Agent 존재 여부가 아니라 서로 호환되는 실행 가능 조합을 기준으로 분기
  const ready = isWorkspaceReady(boot.agents, boot.runtimeStatus);
  return (
    <ReadyWorkspace
      workspace={boot.workspace}
      runtimeStatus={boot.runtimeStatus}
      agents={boot.agents}
      ready={ready}
      onRefresh={boot.refreshRuntimeStatus}
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
  const desk = useDeskItems(workspace.id);
  const sidebarProjects = useSidebarProjects(workspace.id);
  return (
    <Styled.Shell>
      <ScrollToTop />
      <TaskNotifications workspaceId={workspace.id} />
      <AppSidebar
        workspace={workspace}
        runtimeStatus={runtimeStatus}
        deskCount={desk.items.length}
        projects={sidebarProjects}
      />
      <Styled.Content>
        <LegacyResetNotice resetAt={runtimeStatus.legacyDataResetAt} />
        <Suspense fallback={<PageLoading>화면을 준비하는 중...</PageLoading>}>
          <Routes>
            <Route
              path="/"
              element={
                <OfficeHomePage
                  workspace={workspace}
                  readiness={{ ready, showSetupNotice, onResumeOnboarding }}
                />
              }
            />
            <Route path="/inbox" element={<InboxPage workspace={workspace} />} />
            <Route path="/projects" element={<ProjectsPage workspace={workspace} />} />
            <Route path="/projects/:id" element={<ProjectWorkspacePage workspace={workspace} />} />
            <Route path="/agents" element={<OrgChartPage workspace={workspace} />} />
            <Route path="/agents/:id" element={<AgentDetailPage workspace={workspace} />} />
            <Route path="/skills" element={<SkillsPage workspace={workspace} />} />
            <Route path="/records" element={<RecordsPage workspace={workspace} />} />
            <Route path="/performance" element={<PerformancePage workspace={workspace} />} />
            <Route path="/chat" element={<ChatPage workspace={workspace} />} />
            <Route path="/chat/:taskId" element={<ChatPage workspace={workspace} />} />
            <Route path="/settings" element={<SettingsPage workspace={workspace} />} />
            <Route path="/new" element={<NewRequestPage workspace={workspace} />} />
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
