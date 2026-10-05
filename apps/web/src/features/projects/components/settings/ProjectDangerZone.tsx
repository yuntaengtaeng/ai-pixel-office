import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import type { Project } from "@ai-pixel-office/domain/entities";
import { projectApi } from "../../api.ts";
import { useAlertDialog, useConfirmDialog } from "../../../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../../../shared/lib/errors.ts";
import { AlertDialog, ConfirmDialog } from "../../../../shared/ui/FeedbackDialogs.tsx";
import { ErrorBanner } from "../../../../shared/ui/ErrorBanner.tsx";
import { PanelSection } from "../../../../shared/ui/PanelSection.tsx";

const Hint = styled.small`
  color: ${({ theme }) => theme.colors.text.muted};
`;

/** 프로젝트 삭제 (연결된 기안서가 있으면 막음, 프로젝트 폴더는 지우지 않음) */
export function ProjectDangerZone({
  project,
  requestCount,
  onRemoved,
}: {
  project: Project;
  requestCount: number;
  onRemoved: () => void;
}) {
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirmDialog();
  const { alert, dialogProps: alertDialogProps } = useAlertDialog();
  const remove = useMutation({
    mutationFn: () => projectApi.remove(project.id),
    onSuccess: () => {
      onRemoved();
      navigate("/projects");
    },
  });
  return (
    <PanelSection title="프로젝트 삭제">
      <Hint>앱에서 프로젝트 연결만 지워요. 프로젝트 폴더와 그 안의 파일은 그대로예요.</Hint>
      <Button
        type="button"
        $variant="danger"
        disabled={remove.isPending}
        onClick={async () => {
          if (requestCount > 0) {
            await alert({
              title: "프로젝트를 삭제할 수 없어요",
              description: `연결된 기안서가 ${requestCount}개 있어요. 기안서를 옮기거나 취소한 뒤 다시 시도해 주세요.`,
            });
            return;
          }
          if (
            await confirm({
              title: `${project.name} 프로젝트를 삭제할까요?`,
              description: "삭제하면 되돌릴 수 없어요.",
              confirmLabel: "프로젝트 삭제",
              tone: "danger",
            })
          )
            remove.mutate();
        }}
      >
        프로젝트 삭제
      </Button>
      {remove.isError && <ErrorBanner>{messageOf(remove.error)}</ErrorBanner>}
      <ConfirmDialog {...dialogProps} />
      <AlertDialog {...alertDialogProps} />
    </PanelSection>
  );
}
