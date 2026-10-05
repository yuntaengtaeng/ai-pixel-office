import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import {
  taskApi,
  WorkspaceConflictError,
  type TaskDetail,
  type WorkspaceFileChange,
} from "../../api.ts";
import { latestVerifications } from "../../utils/requestReview.ts";
import { messageOf } from "../../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../../shared/ui/ErrorBanner.tsx";
import { FileDiffDialog } from "./FileDiffDialog.tsx";

const CHANGE_LABEL: Record<WorkspaceFileChange["status"], string> = {
  added: "새 파일",
  modified: "수정",
  deleted: "삭제",
};

const Styled = {
  Section: styled.section`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    h3 {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    }
  `,
  List: styled.ul`
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    li {
      display: flex;
      justify-content: space-between;
      gap: ${({ theme }) => theme.space.x2};
      padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x3}`};
      border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      overflow-wrap: anywhere;
    }
    li:last-child {
      border-bottom: 0;
    }
  `,
  FileButton: styled.button`
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.space.x2};
    align-items: start;
    padding: 0;
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.primary};
    font: inherit;
    text-align: left;
    cursor: pointer;
    span:first-child {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    &:hover span:first-child {
      text-decoration: underline;
    }
  `,
  ChangeBadge: styled.span`
    flex: none;
    white-space: nowrap;
    padding: 0 ${({ theme }) => theme.space.x2};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.pill};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-family: ${({ theme }) => theme.typography.fontFamily.base};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
  `,
  Check: styled.li<{ $passed: boolean }>`
    span:last-child {
      color: ${({ $passed, theme }) =>
        $passed ? theme.colors.text.positive : theme.colors.text.negative};
    }
  `,
  Muted: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
  Conflict: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.stamp.ink};
    border-radius: ${({ theme }) => theme.radius.md};
    color: ${({ theme }) => theme.colors.text.secondary};
    strong {
      color: ${({ theme }) => theme.colors.text.primary};
    }
  `,
};

/** 결재할 근거 (바뀐 파일, 확인 결과)와 결재, 겹쳤을 때 맞춰 달라고 하기 */
export function RequestReviewPanel({
  task,
  onChanged,
}: {
  task: TaskDetail;
  onChanged: () => void;
}) {
  const workspace = useQuery({
    queryKey: ["task-workspace", task.id],
    queryFn: () => taskApi.workspace(task.id),
  });
  const approve = useMutation({ mutationFn: () => taskApi.approve(task.id), onSuccess: onChanged });
  const realign = useMutation({
    mutationFn: () => taskApi.realign(task.id),
    onSuccess: () => {
      approve.reset();
      onChanged();
    },
  });
  const [diffPath, setDiffPath] = useState<string>();
  const verifications = latestVerifications(task.runs);
  const conflicted = approve.error instanceof WorkspaceConflictError;
  const summary = workspace.data;

  return (
    <>
      <Styled.Section>
        <h3>바뀐 파일</h3>
        {!summary ? (
          <Styled.Muted>불러오는 중…</Styled.Muted>
        ) : !summary.isolated ? (
          <Styled.Muted>프로젝트 폴더에서 직접 작업한 기안서예요.</Styled.Muted>
        ) : summary.inside.length === 0 ? (
          <Styled.Muted>바뀐 파일이 없어요.</Styled.Muted>
        ) : (
          <Styled.List>
            {summary.inside.map((change) => (
              <li key={change.path}>
                <Styled.FileButton
                  type="button"
                  aria-label={`${change.path} ${CHANGE_LABEL[change.status]}, 바뀐 내용 보기`}
                  onClick={() => setDiffPath(change.path)}
                >
                  <span>{change.path}</span>
                  <Styled.ChangeBadge>{CHANGE_LABEL[change.status]}</Styled.ChangeBadge>
                </Styled.FileButton>
              </li>
            ))}
          </Styled.List>
        )}
        {summary?.isolated && summary.inside.length > 0 && (
          <Styled.Muted>파일을 누르면 바뀐 내용을 볼 수 있어요.</Styled.Muted>
        )}
        {summary?.isolated && summary.outside.length > 0 && (
          <Styled.Muted>
            프로젝트 폴더 밖 변경 {summary.outside.length}개는 결재해도 반영하지 않아요.
          </Styled.Muted>
        )}
      </Styled.Section>
      <FileDiffDialog taskId={task.id} path={diffPath} onClose={() => setDiffPath(undefined)} />
      <Styled.Section>
        <h3>확인 결과</h3>
        {verifications.length === 0 ? (
          <Styled.Muted>실행한 확인이 없어요. 결재 전에 결과를 직접 살펴봐 주세요.</Styled.Muted>
        ) : (
          <Styled.List>
            {verifications.map((check) => (
              <Styled.Check key={check.command} $passed={check.passed}>
                <span>{check.command}</span>
                <span>{check.passed ? "통과" : "실패"}</span>
              </Styled.Check>
            ))}
          </Styled.List>
        )}
      </Styled.Section>
      {conflicted ? (
        <Styled.Conflict>
          <strong>먼저 반영된 변경과 겹쳐요</strong>
          <span>
            프로젝트 폴더는 바뀌지 않았어요. 지금 폴더 상태에 맞춰 다시 얹고, 겹친 곳은 담당 동료가
            정리해요.
          </span>
          <Button $variant="primary" disabled={realign.isPending} onClick={() => realign.mutate()}>
            {realign.isPending ? "맞추는 중" : "맞춰 달라고 하기"}
          </Button>
        </Styled.Conflict>
      ) : (
        <Button
          $variant="stamp"
          $fullWidth
          disabled={approve.isPending}
          onClick={() => approve.mutate()}
        >
          {approve.isPending ? "결재하는 중" : "결재"}
        </Button>
      )}
      {approve.isError && !conflicted && <ErrorBanner>{messageOf(approve.error)}</ErrorBanner>}
      {realign.isError && <ErrorBanner>{messageOf(realign.error)}</ErrorBanner>}
    </>
  );
}
