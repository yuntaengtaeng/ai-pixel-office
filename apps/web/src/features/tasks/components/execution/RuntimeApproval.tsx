import { Button } from "@ai-pixel-office/design-system";
import type { Agent } from "@ai-pixel-office/domain/entities";
import type { ApprovalDecision } from "@ai-pixel-office/runtime-protocol";
import styled from "styled-components";
import type { activityApi } from "../../../activity/api.ts";
import { PetPreview } from "../../../office/PetPreview.tsx";

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space.x2};
`;

const Container = styled.section`
  min-width: 0;
  max-width: min(100%, 640px);
  display: grid;
  gap: ${({ theme }) => theme.space.x3};
  padding: ${({ theme }) => theme.space.x4};
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  border-radius: ${({ theme }) => theme.radius.xl};
  background: ${({ theme }) => theme.colors.background.surfaceRaised};

  strong {
    color: ${({ theme }) => theme.colors.text.primary};
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    line-height: 1.55;
  }

  pre {
    margin: 0;
    padding: ${({ theme }) => theme.space.x3};
    overflow: auto;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    color: ${({ theme }) => theme.colors.text.primary};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  small {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    line-height: 1.45;
  }
  div {
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.space.x2};
  }
`;
export function RuntimeApproval({
  activity,
  agent,
  pending,
  onDecision,
}: {
  activity: Awaited<ReturnType<typeof activityApi.list>>[number];
  agent?: Agent;
  pending: boolean;
  onDecision: (decision: ApprovalDecision) => void;
}) {
  const details = (activity.metadata?.details ?? {}) as Record<string, unknown>;
  const reason =
    typeof details.reason === "string"
      ? details.reason
      : "에이전트가 명령 실행 권한을 요청했습니다.";
  const command = typeof details.command === "string" ? details.command : undefined;
  const target =
    typeof details.path === "string"
      ? details.path
      : typeof details.file_path === "string"
        ? details.file_path
        : undefined;
  const permissionLabel =
    activity.metadata?.permission === "terminal"
      ? "터미널 명령"
      : activity.metadata?.permission === "file_write"
        ? "파일 변경"
        : "추가 권한";
  const supportsSessionApproval =
    activity.metadata?.permission === "terminal" || activity.metadata?.permission === "file_write";
  const requestTitle =
    activity.metadata?.permission === "terminal"
      ? "명령을 실행해도 될까요?"
      : activity.metadata?.permission === "file_write"
        ? "파일을 변경해도 될까요?"
        : "작업을 계속하려면 확인이 필요해요.";
  return (
    <Row>
      <PetPreview petId={agent?.avatarId ?? ""} size={28} />
      <Container aria-label={`${agent?.name ?? "동료"}의 ${permissionLabel} 확인 요청`}>
        <strong>{requestTitle}</strong>
        <p>{reason}</p>
        {command && <pre>{command}</pre>}
        {target && <pre>{target}</pre>}
        <small>
          {supportsSessionApproval
            ? "이번만 허용하거나, 현재 작업을 마칠 때까지 허용할 수 있어요."
            : "이번만 허용하면 이 요청에만 적용돼요."}
        </small>
        <div>
          <Button $variant="primary" disabled={pending} onClick={() => onDecision("accept")}>
            이번만 허용
          </Button>
          {supportsSessionApproval && (
            <Button
              $variant="secondary"
              disabled={pending}
              onClick={() => onDecision("acceptForSession")}
            >
              이번 작업 동안 허용
            </Button>
          )}
          <Button $variant="secondary" disabled={pending} onClick={() => onDecision("decline")}>
            이번에는 하지 않기
          </Button>
          <Button $variant="danger" disabled={pending} onClick={() => onDecision("cancel")}>
            작업 멈추기
          </Button>
        </div>
      </Container>
    </Row>
  );
}
