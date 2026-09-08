import { PETS } from "@ai-pixel-office/pet";
import { useState } from "react";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import { PetPreview } from "../../office/PetPreview.tsx";

const Screen = styled.main`
  min-height: 100dvh;
  padding: ${({ theme }) => theme.space.x5};
  display: grid;
  place-content: center;
  gap: ${({ theme }) => theme.space.x5};
  text-align: center;
  background: ${({ theme }) => theme.colors.background.canvas};
`;
const Office = styled.div`
  position: relative;
  width: min(680px, calc(100vw - 32px));
  min-height: clamp(250px, 42vw, 330px);
  padding: 0 ${({ theme }) => theme.space.x5} ${({ theme }) => theme.space.x3};
  border: 3px solid #6f4c42;
  background:
    repeating-linear-gradient(0deg, transparent 0 25px, rgb(111 76 66 / 8%) 25px 27px),
    linear-gradient(#e9c99d 0 72%, #b88b61 72% 76%, #d7b786 76% 100%);
  box-shadow: 8px 8px 0 rgb(111 76 66 / 22%);
  display: flex;
  align-items: end;
  justify-content: space-around;
  overflow: hidden;

  &::before {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 196px;
    height: 176px;
    border: 7px solid #6f4c42;
    border-bottom: 0;
    background:
      linear-gradient(90deg, transparent 48%, #6f4c42 48% 52%, transparent 52%),
      linear-gradient(135deg, rgb(255 255 255 / 28%) 0 18%, transparent 18% 100%),
      #8fc3c3;
    box-shadow: inset 0 -18px 0 rgb(75 109 92 / 22%);
    content: "";
    transform: translateX(-50%);
  }

  &::after {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 230px;
    height: 30px;
    background: #795548;
    content: "";
    clip-path: polygon(10% 0, 90% 0, 100% 100%, 0 100%);
    transform: translateX(-50%);
  }

  @media (max-width: 520px) {
    min-height: 240px;
    padding-inline: ${({ theme }) => theme.space.x2};

    &::before {
      width: 142px;
      height: 146px;
    }

    &::after {
      width: 168px;
    }
  }
`;
const Window = styled.div<{ $side: "left" | "right" }>`
  position: absolute;
  top: 82px;
  ${({ $side }) => ($side === "left" ? "left: 6%;" : "right: 6%;")}
  width: 23%;
  height: 92px;
  border: 6px solid #6f4c42;
  background:
    linear-gradient(90deg, transparent 47%, #f6e7ce 47% 53%, transparent 53%),
    linear-gradient(transparent 45%, #f6e7ce 45% 55%, transparent 55%),
    linear-gradient(#8bc9d0, #c8e4d9);
  box-shadow: inset 0 -12px 0 rgb(75 109 92 / 15%);
`;
const OfficeSign = styled.div`
  position: absolute;
  top: 22px;
  left: 50%;
  padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x5}`};
  border: 5px solid #6f4c42;
  background: #f6e7ce;
  color: #5b4b42;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  letter-spacing: 0.08em;
  box-shadow: 4px 4px 0 rgb(111 76 66 / 20%);
  transform: translateX(-50%);
`;
const Canopy = styled.div`
  position: absolute;
  z-index: 1;
  top: 77px;
  left: 50%;
  width: 244px;
  height: 28px;
  border: 5px solid #6f4c42;
  background: repeating-linear-gradient(90deg, #bc695b 0 30px, #f6e7ce 30px 60px);
  transform: translateX(-50%);
`;
const Planter = styled.div<{ $side: "left" | "right" }>`
  position: absolute;
  z-index: 2;
  bottom: 36px;
  ${({ $side }) => ($side === "left" ? "left: 8%;" : "right: 8%;")}
  width: 46px;
  height: 42px;
  border: 4px solid #6f4c42;
  background: #b66d48;

  &::before {
    position: absolute;
    left: 7px;
    bottom: 36px;
    width: 25px;
    height: 48px;
    background: #65976c;
    content: "";
    clip-path: polygon(50% 0, 70% 28%, 100% 20%, 82% 55%, 100% 75%, 62% 70%, 50% 100%, 38% 70%, 0 75%, 18% 55%, 0 20%, 30% 28%);
  }
`;
const Commuter = styled.div<{ $lane: number }>`
  position: relative;
  z-index: 1;
  /* 실제 준비 완료를 늦추지 않는 장식 animation이며 motion 감소 환경에서는 정적 장면 제공 */
  animation: commute 700ms ${({ $lane }) => $lane * 90}ms both;
  @keyframes commute {
    from {
      transform: translate(-140px, 28px);
    }
    to {
      transform: translate(0, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  img,
  canvas {
    border: 0;
    background: transparent;
    filter: drop-shadow(3px 4px 0 rgb(91 75 66 / 22%));
  }
`;
const Copy = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space.x2};
  h1,
  p {
    margin: 0;
  }
  p {
    color: ${({ theme }) => theme.colors.text.muted};
  }
`;

export function CommuteSplash({
  message,
  error,
  onRetry,
}: {
  message: string;
  error?: string;
  onRetry?: () => void;
}) {
  // 다시 렌더링될 때 Pet이 바뀌어 깜빡이지 않도록 splash 인스턴스마다 한 번만 무작위 선택
  const [commuters] = useState(() => {
    const candidates = [...PETS];
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[target]] = [candidates[target]!, candidates[index]!];
    }
    return candidates.slice(0, 3);
  });
  return (
    <Screen>
      <Office aria-hidden="true">
        <Window $side="left" />
        <Window $side="right" />
        <OfficeSign>AI PIXEL OFFICE</OfficeSign>
        <Canopy />
        <Planter $side="left" />
        <Planter $side="right" />
        {commuters.map((pet, index) => (
          <Commuter key={pet.id} $lane={index}>
            <PetPreview petId={pet.id} size={72} />
          </Commuter>
        ))}
      </Office>
      <Copy
        role={error ? "alert" : "status"}
        aria-live={error ? "assertive" : "polite"}
        aria-atomic="true"
      >
        <h1>{error ? "오피스를 열지 못했어요" : "동료들이 출근하고 있어요"}</h1>
        <p>{error ?? message}</p>
        {error && <p>기존 오피스 데이터는 삭제되지 않았습니다.</p>}
      </Copy>
      {error && onRetry && (
        <Button $variant="primary" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </Screen>
  );
}
