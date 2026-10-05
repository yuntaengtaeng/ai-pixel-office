import { PETS } from "@ai-pixel-office/pet";
import { useState } from "react";
import styled, { keyframes } from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import { OFFICE_PALETTE } from "../../office/utils/officePalette.ts";
import { AGENT_ROLES, COMMUTER_COUNT, commuterTimeline } from "../utils/splashTimeline.ts";
import { Commuter } from "./Commuter.tsx";
import { StageScenery } from "./StageScenery.tsx";

const LANES = Array.from({ length: COMMUTER_COUNT }, (_, lane) => commuterTimeline(lane));

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;
const shimmer = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
`;

const Styled = {
  Screen: styled.main`
    min-height: 100dvh;
    padding: ${({ theme }) => theme.space.x5};
    display: grid;
    place-content: center;
    justify-items: center;
    gap: ${({ theme }) => theme.space.x6};
    text-align: center;
    background:
      radial-gradient(ellipse 60% 45% at 50% 38%, ${OFFICE_PALETTE.glass}1f, transparent 70%),
      ${({ theme }) => theme.colors.background.canvas};
  `,
  Stage: styled.div`
    position: relative;
    width: min(760px, calc(100vw - 32px));
    height: 300px;
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.xl};
    box-shadow: ${({ theme }) => theme.floatingShadow};
    animation: ${riseIn} 420ms ease-out both;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
  Copy: styled.div`
    display: grid;
    justify-items: center;
    gap: ${({ theme }) => theme.space.x3};
    animation: ${riseIn} 480ms 180ms ease-out both;
    h1 {
      font-size: ${({ theme }) => theme.typography.fontSize.displaySm};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      letter-spacing: -0.02em;
    }
    p {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.lead};
    }
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
  Status: styled.div`
    display: grid;
    justify-items: center;
    gap: ${({ theme }) => theme.space.x2};
    min-height: 44px;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
  Progress: styled.span`
    position: relative;
    width: 180px;
    height: 3px;
    overflow: hidden;
    border-radius: ${({ theme }) => theme.radius.pill};
    background: ${({ theme }) => theme.colors.border.subtle};
    &::after {
      content: "";
      position: absolute;
      inset: 0;
      width: 40%;
      border-radius: inherit;
      background: ${({ theme }) => theme.colors.brand.primary};
      animation: ${shimmer} 1.1s ease-in-out infinite;
    }
  `,
  Error: styled.div`
    display: grid;
    justify-items: center;
    gap: ${({ theme }) => theme.space.x2};
    strong {
      color: ${({ theme }) => theme.colors.text.primary};
      font-size: ${({ theme }) => theme.typography.fontSize.lead};
    }
    p {
      color: ${({ theme }) => theme.colors.text.secondary};
    }
  `,
};

function pickCommuters() {
  const candidates = PETS.filter((pet) => !pet.unlock);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target]!, candidates[index]!];
  }
  return candidates.slice(0, COMMUTER_COUNT);
}

/** 앱 시작 화면 (픽셀 마을의 동료들이 에이전트 등록 게이트를 지나 사무실 자리에 앉는 장면, 실패 시 다시 시도) */
export function CommuteSplash({
  message,
  error,
  onRetry,
}: {
  message: string;
  error?: string;
  onRetry?: () => void;
}) {
  const [commuters] = useState(pickCommuters);
  return (
    <Styled.Screen>
      <Styled.Stage aria-hidden="true">
        <StageScenery lanes={LANES} />
        {commuters.map((pet, lane) => (
          <Commuter
            key={pet.id}
            petId={pet.id}
            role={AGENT_ROLES[COMMUTER_COUNT - 1 - lane]!}
            lane={LANES[lane]!}
          />
        ))}
      </Styled.Stage>
      <Styled.Copy>
        <h1>Pixel Office</h1>
        <p>픽셀 친구들이 오늘부터 당신의 AI 팀으로 출근해요</p>
      </Styled.Copy>
      <Styled.Status
        role={error ? "alert" : "status"}
        aria-live={error ? "assertive" : "polite"}
        aria-atomic="true"
      >
        {error ? (
          <Styled.Error>
            <strong>오피스를 열지 못했어요</strong>
            <p>{error}</p>
            <p>기존 오피스 데이터는 삭제되지 않았어요.</p>
            {onRetry && (
              <Button $variant="primary" onClick={onRetry}>
                다시 시도
              </Button>
            )}
          </Styled.Error>
        ) : (
          <>
            <Styled.Progress aria-hidden="true" />
            <span>{message}</span>
          </>
        )}
      </Styled.Status>
    </Styled.Screen>
  );
}
