import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import styled from "styled-components";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { projectApi } from "../projects/api.ts";
import { useTaskDetail, useTaskRefresh } from "./hooks/useTaskDetail.ts";
import { RequestHeader } from "./components/detail/RequestHeader.tsx";
import { RequestConversation } from "./components/detail/RequestConversation.tsx";
import { RequestMessageBar } from "./components/detail/RequestMessageBar.tsx";
import { RequestSetupPanel } from "./components/detail/RequestSetupPanel.tsx";
import { RequestContextSection } from "./components/detail/RequestContextSection.tsx";
import { RequestDangerZone } from "./components/detail/RequestDangerZone.tsx";
import { RequestReviewPanel } from "./components/review/RequestReviewPanel.tsx";
import { RunHistory } from "./components/results/RunHistory.tsx";
import { messageOf } from "../../shared/lib/errors.ts";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { FullScreenMessage } from "../../shared/ui/FullScreenMessage.tsx";
import { PanelSection } from "../../shared/ui/PanelSection.tsx";

const Styled = {
  Layout: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: ${({ theme }) => theme.space.x6};
    align-items: start;
    @media ${({ theme }) => theme.mediaQuery.lg} {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  Main: styled.div`
    min-width: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  Side: styled.aside`
    display: grid;
    gap: ${({ theme }) => theme.space.x6};
    padding: ${({ theme }) => theme.space.x4};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
  `,
  History: styled.details`
    summary {
      cursor: pointer;
      color: ${({ theme }) => theme.colors.text.muted};
    }
  `,
};

/** 기안서 화면 (가운데 대화와 입력창, 오른쪽 결재 근거와 진행·준비·실행 환경) */
export function TaskDetailPage({ workspace }: { workspace: Workspace }) {
  const { id = "" } = useParams();
  const { task, agents, latestRun, pendingApproval } = useTaskDetail(id, workspace);
  const refresh = useTaskRefresh(id, workspace.id);
  const projectId = task.data?.projectId;
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: Boolean(projectId),
  });

  if (task.isPending) return <FullScreenMessage>기안서를 불러오는 중...</FullScreenMessage>;
  if (!task.data || task.isError)
    return <FullScreenMessage error>{messageOf(task.error)}</FullScreenMessage>;
  const item = task.data;

  return (
    <BaseLayout>
      <RequestHeader task={item} project={project.data} agents={agents} />
      <Styled.Layout>
        <Styled.Main>
          <RequestConversation
            task={item}
            agents={agents}
            latestRun={latestRun}
            pendingApproval={pendingApproval}
            onChanged={refresh}
          />
          <RequestMessageBar
            task={item}
            workspace={workspace}
            latestRun={latestRun}
            onChanged={refresh}
          />
          {item.runs.length > 0 && (
            <Styled.History>
              <summary>실행 기록 {item.runs.length}개</summary>
              <RunHistory runs={item.runs} progressByRun={item.progressByRun} />
            </Styled.History>
          )}
        </Styled.Main>
        <Styled.Side>
          {item.status === "needs_review" && (
            <PanelSection title="결재">
              <RequestReviewPanel task={item} onChanged={refresh} />
            </PanelSection>
          )}
          {item.status === "todo" && !item.queuedBehind ? (
            <PanelSection title="시작 전 준비">
              <RequestSetupPanel
                task={item}
                agents={agents}
                workspace={workspace}
                onChanged={refresh}
              />
            </PanelSection>
          ) : null}
          <PanelSection title="실행 환경">
            <RequestContextSection
              task={item}
              agents={agents}
              workspace={workspace}
              latestRun={latestRun}
            />
          </PanelSection>
          <RequestDangerZone task={item} latestRun={latestRun} onChanged={refresh} />
        </Styled.Side>
      </Styled.Layout>
    </BaseLayout>
  );
}
