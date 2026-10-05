import styled, { keyframes } from "styled-components";
import { OFFICE_PALETTE } from "../../office/utils/officePalette.ts";
import { pixelShadow } from "../utils/pixelArt.ts";
import type { CommuterTimeline } from "../utils/splashTimeline.ts";

/** 게이트 왼쪽 픽셀 마을 전용 색 */
const MEADOW = {
  skyTop: "#6fbcf2",
  skyBottom: "#bfe6ff",
  cloud: "#ffffff",
  cloudShade: "#dcefff",
  sun: "#ffd34d",
  sunCore: "#ffe58a",
  grass: "#5cbf4a",
  grassDark: "#4aa63b",
  ground: "#3f8f33",
  flower: "#ff8fb1",
  flowerCore: "#fff3a6",
} as const;

const PIXEL = 4;
export const GATE_LEFT_PERCENT = 43;
export const GATE_RIGHT_PERCENT = 55;
export const CONVEYOR_BOTTOM_PX = 22;
export const CONVEYOR_HEIGHT_PX = 14;

const CLOUD = pixelShadow(["...WWW......", ".WWWWWWW.WW.", "WWWWWWWWWWWW", ".SSSSSSSSSS."], PIXEL, {
  W: MEADOW.cloud,
  S: MEADOW.cloudShade,
});
const SUN = pixelShadow(
  ["..YYYY..", ".YCCCCY.", "YCCCCCCY", "YCCCCCCY", "YCCCCCCY", "YCCCCCCY", ".YCCCCY.", "..YYYY.."],
  PIXEL,
  { Y: MEADOW.sun, C: MEADOW.sunCore },
);
const FLOWER = pixelShadow([".P.", "PCP", ".P.", ".G."], PIXEL, {
  P: MEADOW.flower,
  C: MEADOW.flowerCore,
  G: MEADOW.grassDark,
});

const drift = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(28px); }
`;
const scan = keyframes`
  0%, 100% { top: 76px; opacity: 0.4; }
  50% { top: calc(100% - 52px); opacity: 1; }
`;
const belt = keyframes`
  from { background-position: 0 0; }
  to { background-position: 24px 0; }
`;
const pulse = keyframes`
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
`;
const screenOn = keyframes`
  0% { background: ${OFFICE_PALETTE.furniture}; box-shadow: none; }
  40% { background: #ffffff; }
  100% { background: ${OFFICE_PALETTE.working}; box-shadow: 0 0 18px ${OFFICE_PALETTE.working}80; }
`;

const Styled = {
  Meadow: styled.div`
    position: absolute;
    inset: 0 ${100 - GATE_LEFT_PERCENT}% 0 0;
    overflow: hidden;
    background: linear-gradient(${MEADOW.skyTop}, ${MEADOW.skyBottom} 72%);
  `,
  PixelArt: styled.span<{ $art: string; $top: number; $left: string; $drift?: boolean }>`
    position: absolute;
    top: ${({ $top }) => $top}px;
    left: ${({ $left }) => $left};
    width: ${PIXEL}px;
    height: ${PIXEL}px;
    box-shadow: ${({ $art }) => $art};
    animation: ${drift} 6s ease-in-out infinite alternate;
    animation-play-state: ${({ $drift }) => ($drift ? "running" : "paused")};
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
  Grass: styled.div`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 78px;
    border-top: ${PIXEL * 2}px solid transparent;
    border-image: repeating-linear-gradient(
        90deg,
        ${MEADOW.grass} 0 ${PIXEL * 2}px,
        ${MEADOW.grassDark} ${PIXEL * 2}px ${PIXEL * 4}px
      )
      1;
    background: ${MEADOW.ground};
  `,
  Office: styled.div`
    position: absolute;
    inset: 0 0 0 ${GATE_RIGHT_PERCENT}%;
    background-color: ${OFFICE_PALETTE.floor};
    background-image:
      linear-gradient(${OFFICE_PALETTE.floorGrid} 1px, transparent 1px),
      linear-gradient(90deg, ${OFFICE_PALETTE.floorGrid} 1px, transparent 1px);
    background-size: 24px 24px;
  `,
  BackWall: styled.div`
    position: absolute;
    inset: 0 0 auto 0;
    height: 64px;
    background: ${OFFICE_PALETTE.screenFrame};
    border-bottom: 1px solid ${OFFICE_PALETTE.furnitureLine};
    &::before {
      content: "";
      position: absolute;
      top: 14px;
      left: 12%;
      right: 12%;
      height: 26px;
      background: repeating-linear-gradient(
        90deg,
        ${OFFICE_PALETTE.glass}33 0 46px,
        transparent 46px 54px
      );
      border-top: 1px solid ${OFFICE_PALETTE.glass}66;
    }
  `,
  Desk: styled.div<{ $left: number }>`
    position: absolute;
    top: 96px;
    left: ${({ $left }) => $left}%;
    width: 78px;
    transform: translateX(-50%);
    display: grid;
    justify-items: center;
    &::after {
      content: "";
      width: 78px;
      height: 10px;
      border-radius: 2px;
      background: ${OFFICE_PALETTE.furniture};
      border: 1px solid ${OFFICE_PALETTE.furnitureLine};
    }
  `,
  Monitor: styled.span<{ $onAtMs: number }>`
    width: 38px;
    height: 24px;
    padding: 3px;
    border-radius: 3px;
    background: ${OFFICE_PALETTE.screenFrame};
    border: 1px solid ${OFFICE_PALETTE.furnitureLine};
    &::before {
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 1px;
      background: ${OFFICE_PALETTE.working};
      box-shadow: 0 0 18px ${OFFICE_PALETTE.working}80;
      animation: ${screenOn} 420ms ${({ $onAtMs }) => $onAtMs}ms ease-out both;
      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }
  `,
  Gate: styled.div`
    position: absolute;
    inset: 0 ${100 - GATE_RIGHT_PERCENT}% 0 ${GATE_LEFT_PERCENT}%;
    background: linear-gradient(90deg, ${MEADOW.skyBottom}00, ${OFFICE_PALETTE.floor} 55%);
  `,
  Pillar: styled.span<{ $side: "left" | "right" }>`
    position: absolute;
    top: 46px;
    bottom: ${CONVEYOR_BOTTOM_PX + CONVEYOR_HEIGHT_PX}px;
    ${({ $side }) => $side}: 0;
    width: 14px;
    border: 1px solid ${OFFICE_PALETTE.glass}99;
    border-radius: 3px;
    background: linear-gradient(${OFFICE_PALETTE.glass}40, ${OFFICE_PALETTE.glass}14);
    box-shadow: 0 0 14px ${OFFICE_PALETTE.glass}40;
  `,
  Header: styled.div`
    position: absolute;
    top: 22px;
    left: -28px;
    right: -28px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid ${OFFICE_PALETTE.glass}80;
    border-radius: 4px;
    background: ${OFFICE_PALETTE.screenFrame};
    color: ${OFFICE_PALETTE.glassLabel};
    font-family: ${({ theme }) => theme.typography.fontFamily.pixel};
    font-size: 10px;
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    letter-spacing: 1.5px;
    white-space: nowrap;
    &::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${OFFICE_PALETTE.glass};
      animation: ${pulse} 1.2s ease-in-out infinite;
    }
  `,
  ScanBeam: styled.span`
    position: absolute;
    top: 76px;
    left: 14px;
    right: 14px;
    height: 2px;
    background: ${OFFICE_PALETTE.glass};
    box-shadow:
      0 0 10px ${OFFICE_PALETTE.glass},
      0 0 24px ${OFFICE_PALETTE.glass}99;
    animation: ${scan} 1.6s ease-in-out infinite;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
      opacity: 0.6;
    }
  `,
  Conveyor: styled.div`
    position: absolute;
    left: 0;
    right: 0;
    bottom: ${CONVEYOR_BOTTOM_PX}px;
    height: ${CONVEYOR_HEIGHT_PX}px;
    border-top: 2px solid ${OFFICE_PALETTE.wall};
    border-bottom: 2px solid ${OFFICE_PALETTE.screenFrame};
    background-color: #1b1f27;
    background-image: repeating-linear-gradient(
      90deg,
      ${OFFICE_PALETTE.wall} 0 10px,
      transparent 10px 24px
    );
    animation: ${belt} 420ms linear infinite;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
};

/** 픽셀 마을, 에이전트 등록 게이트, 사무실, 그 사이를 잇는 컨베이어 */
export function StageScenery({ lanes }: { lanes: CommuterTimeline[] }) {
  return (
    <>
      <Styled.Meadow>
        <Styled.PixelArt $art={SUN} $top={18} $left="10%" />
        <Styled.PixelArt $art={CLOUD} $top={34} $left="34%" $drift />
        <Styled.PixelArt $art={CLOUD} $top={88} $left="4%" $drift />
        <Styled.Grass />
        <Styled.PixelArt $art={FLOWER} $top={232} $left="38%" />
        <Styled.PixelArt $art={FLOWER} $top={244} $left="12%" />
        <Styled.PixelArt $art={FLOWER} $top={238} $left="64%" />
      </Styled.Meadow>
      <Styled.Office>
        <Styled.BackWall />
      </Styled.Office>
      {lanes.map((lane) => (
        <Styled.Desk key={lane.toPercent} $left={lane.toPercent}>
          <Styled.Monitor $onAtMs={lane.arriveAtMs} />
        </Styled.Desk>
      ))}
      <Styled.Gate>
        <Styled.Pillar $side="left" />
        <Styled.Pillar $side="right" />
        <Styled.ScanBeam />
        <Styled.Header>AGENT ONBOARDING</Styled.Header>
      </Styled.Gate>
      <Styled.Conveyor />
    </>
  );
}
