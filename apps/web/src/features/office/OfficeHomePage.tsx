import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import type { Task, Workspace } from "@ai-pixel-office/domain/entities";
import { agentApi } from "../agents/api.ts";
import { taskApi } from "../tasks/api.ts";
import { DeskPanel } from "../desk/components/DeskPanel.tsx";
import { useDeskItems } from "../desk/hooks/useDeskItems.ts";
import { DESK_DOCUMENT_LABEL } from "../desk/utils/deskItems.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { resolveTaskHref } from "../../shared/lib/taskRouting.ts";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { OfficeCard, OfficeLoading } from "./OfficeCard.tsx";
import { InProgressList } from "./components/InProgressList.tsx";

const PixelOffice = lazy(async () => {
  const module = await import("./PixelOffice.tsx");
  return { default: module.PixelOffice };
});

type Readiness = { ready: boolean; showSetupNotice: boolean; onResumeOnboarding: () => void };

const Styled = {
  Header: styled.header`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x4};
    margin-bottom: ${({ theme }) => theme.space.x5};
    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.base};
    }
    h1 {
      margin-top: ${({ theme }) => theme.space.x1};
      font-family: ${({ theme }) => theme.typography.fontFamily.serif};
      font-size: ${({ theme }) => theme.typography.fontSize.displayXs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
  `,
  SetupNotice: styled.section`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};
    margin-bottom: ${({ theme }) => theme.space.x5};
    padding: ${({ theme }) => theme.space.x4};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
  `,
  Main: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
    gap: ${({ theme }) => theme.space.x5};
    align-items: start;
    margin-bottom: ${({ theme }) => theme.space.x6};
    @media ${({ theme }) => theme.mediaQuery.lg} {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  Office: styled(OfficeCard)`
    margin-bottom: 0;
  `,
};

/** 첫 화면: 오피스 평면도와 결재함, 진행 중인 일 */
export function OfficeHomePage({
  workspace,
  readiness,
}: {
  workspace: Workspace;
  readiness: Readiness;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const desk = useDeskItems(workspace.id);
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const quickAssign = useMutation({
    mutationFn: (input: {
      agentId: string;
      title: string;
      description?: string;
      priority?: NonNullable<Task["priority"]>;
    }) =>
      taskApi.create({
        workspaceId: workspace.id,
        assigneeAgentId: input.agentId,
        title: input.title,
        description: input.description,
        priority: input.priority ?? "medium",
      }),
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/tasks/${task.id}`);
    },
  });
  const agentList = agents.data ?? [];
  const deskLabels = Object.fromEntries(
    [...desk.items]
      .reverse()
      .filter((item) => item.task.assigneeAgentId)
      .map((item) => [item.task.assigneeAgentId!, DESK_DOCUMENT_LABEL[item.kind]]),
  );
  const taskList = tasks.data ?? [];
  const greeting =
    desk.items.length > 0 ? `결재 ${desk.items.length}건이 올라와 있어요` : "결재할 서류가 없어요";

  return (
    <BaseLayout>
      <Styled.Header>
        <div>
          <span>
            {new Intl.DateTimeFormat("ko-KR", {
              month: "long",
              day: "numeric",
              weekday: "long",
            }).format(new Date())}
          </span>
          <h1>{greeting}</h1>
        </div>
        <Button $variant="primary" onClick={() => navigate("/new")}>
          새 요청
        </Button>
      </Styled.Header>
      {readiness.showSetupNotice && (
        <Styled.SetupNotice>
          <span>AI를 연결하고 함께 일할 동료를 만들면 일을 맡길 수 있어요.</span>
          <Button $variant="secondary" onClick={readiness.onResumeOnboarding}>
            출근 준비 이어하기
          </Button>
        </Styled.SetupNotice>
      )}
      {(agents.isError || tasks.isError) && (
        <ErrorBanner>{messageOf(agents.error ?? tasks.error)}</ErrorBanner>
      )}
      <Styled.Main>
        <Styled.Office aria-label="오피스">
          <Suspense fallback={<OfficeLoading>오피스를 여는 중...</OfficeLoading>}>
            <PixelOffice
              agents={agentList}
              tasks={taskList}
              deskLabels={deskLabels}
              onOpenTask={(taskId) => {
                const task = taskList.find((candidate) => candidate.id === taskId);
                navigate(task ? resolveTaskHref(task) : `/tasks/${taskId}`);
              }}
              onQuickAssign={(agentId, title, description, priority) =>
                quickAssign.mutate({ agentId, title, description, priority })
              }
            />
          </Suspense>
          {quickAssign.isError && <ErrorBanner>{messageOf(quickAssign.error)}</ErrorBanner>}
        </Styled.Office>
        <DeskPanel items={desk.items} agents={agentList} now={new Date()} />
      </Styled.Main>
      <InProgressList tasks={taskList} agents={agentList} />
    </BaseLayout>
  );
}
