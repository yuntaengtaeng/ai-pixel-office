import { Button } from "@ai-pixel-office/design-system";
import styled from "styled-components";

import type { SessionLimitReason } from "../../types/execution.ts";
const DESCRIPTION: Record<SessionLimitReason, string> = {
  capacity:
    "현재 진행 내용과 변경된 파일을 보존했습니다. 기존 대화를 유지한 채 세션 한도를 늘려 계속할 수 있습니다.",
  inactivity:
    "5분 동안 새로운 진행이 없어 안전하게 중단했습니다. 기존 대화와 작업 폴더를 그대로 유지해 다시 시작할 수 있습니다.",
  duration:
    "20분 실행 한도에 도달했습니다. 기존 대화와 현재까지의 변경 내용을 유지한 채 계속할 수 있습니다.",
};
const Container = styled.div`
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: ${({ theme }) => theme.space.x3};
  margin-top: ${({ theme }) => theme.space.x5};
  padding: ${({ theme }) => theme.space.x5};
  border: 2px solid ${({ theme }) => theme.colors.border.default};
  background: ${({ theme }) => theme.colors.background.surfaceRaised};
  > span {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: ${({ theme }) => theme.radius.circle};
    background: ${({ theme }) => theme.colors.semantic.warning};
    color: ${({ theme }) => theme.colors.text.inverse};
    font-size: ${({ theme }) => theme.typography.fontSize.headingLg};
    font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
  }
  strong {
    color: ${({ theme }) => theme.colors.text.primary};
  }
  p {
    margin: ${({ theme }) => `${theme.space.x1} 0 ${theme.space.x3}`};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    line-height: 1.6;
  }
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.x2};
`;

export function SessionLimitState({
  reason,
  canExtend,
  extendPending,
  newSessionPending,
  onExtend,
  onNewSession,
}: {
  reason: SessionLimitReason;
  canExtend: boolean;
  extendPending: boolean;
  newSessionPending: boolean;
  onExtend: () => void;
  onNewSession: () => void;
}) {
  return (
    <Container>
      <span>↻</span>
      <div>
        <strong>작업 세션이 일시 중단되었습니다.</strong>
        <p>{DESCRIPTION[reason]}</p>
        <Actions>
          {canExtend && (
            <Button
              $variant="primary"
              disabled={extendPending || newSessionPending}
              onClick={onExtend}
            >
              {extendPending ? "기존 세션 다시 여는 중…" : "같은 세션 한도 늘려 계속"}
            </Button>
          )}
          <Button
            $variant="secondary"
            disabled={extendPending || newSessionPending}
            onClick={onNewSession}
          >
            {newSessionPending ? "새 세션 준비 중…" : "새 세션에서 이어가기"}
          </Button>
        </Actions>
      </div>
    </Container>
  );
}
