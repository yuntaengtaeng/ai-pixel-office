import { Button, Kicker } from "@ai-pixel-office/design-system";
import styled from "styled-components";
import type { activityApi } from "../../../activity/api.ts";

const Container = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.space.x3};
  padding: ${({ theme }) => theme.space.x4};
  border: 2px solid ${({ theme }) => theme.colors.border.negative};
  background: ${({ theme }) => theme.colors.background.negativeSubtle};
  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.text.secondary};
  }
  pre {
    margin: 0;
    padding: ${({ theme }) => theme.space.x3};
    overflow: auto;
    background: ${({ theme }) => theme.colors.semantic.info};
    color: ${({ theme }) => theme.colors.text.inverse};
  }
  div {
    display: flex;
    gap: ${({ theme }) => theme.space.x2};
  }
`;
export function RuntimeApproval({
  activity,
  pending,
  onDecision,
}: {
  activity: Awaited<ReturnType<typeof activityApi.list>>[number];
  pending: boolean;
  onDecision: (decision: "accept" | "cancel") => void;
}) {
  const details = (activity.metadata?.details ?? {}) as Record<string, unknown>;
  const reason =
    typeof details.reason === "string"
      ? details.reason
      : "에이전트가 명령 실행 권한을 요청했습니다.";
  const command = typeof details.command === "string" ? details.command : undefined;
  return (
    <Container>
      <Kicker>APPROVAL REQUIRED</Kicker>
      <strong>작업을 계속하려면 승인이 필요합니다.</strong>
      <p>{reason}</p>
      {command && <pre>{command}</pre>}
      <div>
        <Button $variant="primary" disabled={pending} onClick={() => onDecision("accept")}>
          이번만 승인
        </Button>
        <Button $variant="danger" disabled={pending} onClick={() => onDecision("cancel")}>
          거절
        </Button>
      </div>
    </Container>
  );
}
