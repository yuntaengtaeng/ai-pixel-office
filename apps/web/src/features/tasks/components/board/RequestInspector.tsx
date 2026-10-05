import { Link } from "react-router-dom";
import styled from "styled-components";
import { Button, IconButton, CloseIcon } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { useTaskDetail, useTaskRefresh } from "../../hooks/useTaskDetail.ts";
import { approvalLineCells } from "../../utils/approvalLine.ts";
import { ApprovalLine } from "../approval/ApprovalLine.tsx";
import { TaskStatusPill } from "../TaskStatusPill.tsx";
import { RequestReviewPanel } from "../review/RequestReviewPanel.tsx";
import { MarkdownContent } from "../../../../shared/ui/MarkdownContent.tsx";
import { PanelSection } from "../../../../shared/ui/PanelSection.tsx";

const Styled = {
  Inspector: styled.aside`
    display: grid;
    align-content: start;
    gap: ${({ theme }) => theme.space.x4};
    padding: ${({ theme }) => theme.space.x4};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
  `,
  Top: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    > :last-child {
      margin-left: auto;
    }
  `,
  Title: styled.h2`
    margin: 0;
    font-family: ${({ theme }) => theme.typography.fontFamily.serif};
    font-size: ${({ theme }) => theme.typography.fontSize.lead};
  `,
  Summary: styled.div`
    max-height: 220px;
    overflow-y: auto;
    color: ${({ theme }) => theme.colors.text.secondary};
  `,
};

/** 보드에서 고른 기안서 빠르게 보기 (마지막 결과, 결재, 대화 크게 보기) */
export function RequestInspector({
  taskId,
  workspace,
  onClose,
}: {
  taskId: string;
  workspace: Workspace;
  onClose: () => void;
}) {
  const { task, agents } = useTaskDetail(taskId, workspace);
  const refresh = useTaskRefresh(taskId, workspace.id);
  const item = task.data;
  return (
    <Styled.Inspector aria-label="기안서 미리 보기">
      <Styled.Top>
        {item && <TaskStatusPill task={item} />}
        <Button as={Link} to={`/tasks/${taskId}`} $variant="secondary">
          대화 크게 보기
        </Button>
        <IconButton type="button" aria-label="닫기" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Styled.Top>
      {!item ? (
        <span>불러오는 중…</span>
      ) : (
        <>
          <Styled.Title>{item.title}</Styled.Title>
          <ApprovalLine cells={approvalLineCells(item, agents)} />
          {item.result?.summary && (
            <PanelSection title="마지막 결과">
              <Styled.Summary>
                <MarkdownContent>{item.result.summary}</MarkdownContent>
              </Styled.Summary>
            </PanelSection>
          )}
          {item.status === "needs_review" && (
            <PanelSection title="결재">
              <RequestReviewPanel task={item} onChanged={refresh} />
            </PanelSection>
          )}
        </>
      )}
    </Styled.Inspector>
  );
}
