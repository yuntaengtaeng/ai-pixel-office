import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import type { AgentRun } from "@ai-pixel-office/domain/entities";
import { taskApi, type TaskDetail } from "../../api.ts";
import { isRunActive } from "../../utils/pendingApproval.ts";
import { useConfirmDialog } from "../../../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../../../shared/lib/errors.ts";
import { ConfirmDialog } from "../../../../shared/ui/FeedbackDialogs.tsx";
import { ErrorBanner } from "../../../../shared/ui/ErrorBanner.tsx";

const Zone = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.x2};
  padding-top: ${({ theme }) => theme.space.x3};
  border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
  span {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  }
`;

/** 실행 취소와 기안 취소(기안서와 작업 공간 삭제) */
export function RequestDangerZone({
  task,
  latestRun,
  onChanged,
}: {
  task: TaskDetail;
  latestRun?: AgentRun;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirmDialog();
  const running = isRunActive(latestRun);
  const cancel = useMutation({
    mutationFn: () => taskApi.cancelRun(latestRun!.id),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => taskApi.remove(task.id),
    onSuccess: () => {
      onChanged();
      navigate(task.projectId ? `/projects/${task.projectId}` : "/");
    },
  });
  const error = cancel.error ?? remove.error;

  return (
    <Zone>
      {running && (
        <Button
          $variant="danger"
          $fullWidth
          disabled={cancel.isPending}
          onClick={() => cancel.mutate()}
        >
          {cancel.isPending ? "멈추는 중" : "지금 실행 멈추기"}
        </Button>
      )}
      <span>
        기안 취소는 기안서와 작업 공간을 지워요. 결재 전 변경은 프로젝트 폴더에 남지 않아요.
      </span>
      <Button
        $variant="secondary"
        $fullWidth
        disabled={running || remove.isPending}
        onClick={async () => {
          if (
            await confirm({
              title: "기안을 취소할까요?",
              description: `'${task.title}'의 대화와 결과, 작업 공간이 함께 지워져요.`,
              confirmLabel: "기안 취소",
              tone: "danger",
            })
          )
            remove.mutate();
        }}
      >
        {remove.isPending ? "지우는 중…" : "기안 취소"}
      </Button>
      {error && <ErrorBanner>{messageOf(error)}</ErrorBanner>}
      <ConfirmDialog {...dialogProps} />
    </Zone>
  );
}
