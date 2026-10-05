import { useQuery } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Dialog, useDialogIds } from "@ai-pixel-office/design-system";
import { taskApi } from "../../api.ts";
import { diffLines, diffStats } from "../../../../shared/lib/diffLines.ts";
import { messageOf } from "../../../../shared/lib/errors.ts";
import { DiffView } from "../../../../shared/ui/DiffView.tsx";
import { ErrorBanner } from "../../../../shared/ui/ErrorBanner.tsx";

const Styled = {
  Dialog: styled(Dialog)`
    .dialog-content {
      width: min(1000px, calc(100vw - 28px));
      display: grid;
      gap: ${({ theme }) => theme.space.x4};
    }
  `,
  Header: styled.header`
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: ${({ theme }) => theme.space.x3};
    h2 {
      margin: 0;
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.lg};
      overflow-wrap: anywhere;
    }
  `,
  Stats: styled.span`
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    b:first-child {
      color: ${({ theme }) => theme.colors.text.positive};
    }
    b:last-child {
      margin-left: ${({ theme }) => theme.space.x2};
      color: ${({ theme }) => theme.colors.text.negative};
    }
  `,
  Footer: styled.footer`
    display: flex;
    justify-content: flex-end;
  `,
};

/** 결재 전에 파일 하나가 바뀐 내용 보기 */
export function FileDiffDialog({
  taskId,
  path,
  onClose,
}: {
  taskId: string;
  /** 볼 파일 (없으면 닫힘) */
  path?: string;
  onClose: () => void;
}) {
  const { titleId } = useDialogIds();
  const diff = useQuery({
    queryKey: ["task-diff", taskId, path],
    queryFn: () => taskApi.workspaceDiff(taskId, path ?? ""),
    enabled: Boolean(path),
  });
  const stats = diff.data ? diffStats(diffLines(diff.data.diff)) : undefined;

  return (
    <Styled.Dialog
      open={Boolean(path)}
      onOpenChange={(open) => !open && onClose()}
      titleId={titleId}
    >
      <Styled.Header>
        <h2 id={titleId}>{path}</h2>
        {stats && (
          <Styled.Stats aria-label={`${stats.added}줄 추가, ${stats.removed}줄 삭제`}>
            <b>+{stats.added}</b>
            <b>−{stats.removed}</b>
          </Styled.Stats>
        )}
      </Styled.Header>
      {diff.isPending && <span>바뀐 내용을 불러오는 중…</span>}
      {diff.isError && <ErrorBanner>{messageOf(diff.error)}</ErrorBanner>}
      {diff.data &&
        (diff.data.diff.trim() ? (
          <DiffView patch={diff.data.diff} label={`${path ?? ""} 바뀐 내용`} />
        ) : (
          <span>보여줄 차이가 없어요.</span>
        ))}
      <Styled.Footer>
        <Button type="button" $variant="secondary" onClick={onClose}>
          닫기
        </Button>
      </Styled.Footer>
    </Styled.Dialog>
  );
}
