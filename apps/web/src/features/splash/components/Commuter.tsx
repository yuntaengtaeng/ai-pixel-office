import styled, { css, keyframes } from "styled-components";
import { PetPreview } from "../../office/PetPreview.tsx";
import { OFFICE_PALETTE } from "../../office/utils/officePalette.ts";
import type { CommuterTimeline } from "../utils/splashTimeline.ts";
import { CONVEYOR_BOTTOM_PX, CONVEYOR_HEIGHT_PX } from "./StageScenery.tsx";

const PET_SIZE = 64;
const HOP_MS = 440;

const ride = keyframes`
  from { left: var(--from); }
  to { left: var(--to); }
`;
const hop = keyframes`
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
`;
const dragged = keyframes`
  0% { transform: rotate(0deg); }
  10% { transform: rotate(-14deg) translateX(-3px); }
  50% { transform: rotate(-10deg) translateX(-2px); }
  88% { transform: rotate(-14deg) translateX(-3px); }
  100% { transform: rotate(0deg); }
`;
const breathe = keyframes`
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.04); }
`;
const scanFlash = keyframes`
  0%, 100% { filter: none; }
  35% { filter: brightness(2.4) saturate(0); }
`;
const popIn = keyframes`
  0% { opacity: 0; transform: translate(-50%, 6px) scale(0.6); }
  70% { opacity: 1; transform: translate(-50%, -2px) scale(1.08); }
  100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
`;
const fadeOut = keyframes`
  to { opacity: 0; transform: translate(-50%, -6px); }
`;
const swingIn = keyframes`
  0% { opacity: 0; transform: translateX(-50%) rotate(-40deg) scale(0.4); }
  60% { opacity: 1; transform: translateX(-50%) rotate(12deg) scale(1.1); }
  100% { opacity: 1; transform: translateX(-50%) rotate(0deg) scale(1); }
`;

const ms = (value: number) => `${value}ms`;

const Styled = {
  Commuter: styled.div<{ $lane: CommuterTimeline }>`
    --from: ${({ $lane }) => $lane.fromPercent}%;
    --to: ${({ $lane }) => $lane.toPercent}%;
    position: absolute;
    bottom: ${CONVEYOR_BOTTOM_PX + CONVEYOR_HEIGHT_PX - 4}px;
    left: var(--to);
    width: ${PET_SIZE}px;
    margin-left: ${-PET_SIZE / 2}px;
    animation: ${ride} ${({ $lane }) => ms($lane.travelMs)} ${({ $lane }) => ms($lane.departAtMs)}
      linear both;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
  Body: styled.div<{ $lane: CommuterTimeline }>`
    position: relative;
    transform-origin: bottom center;
    ${({ $lane }) => css`
      animation:
        ${hop} ${HOP_MS}ms ease-out ${Math.floor($lane.departAtMs / HOP_MS)},
        ${dragged} ${ms($lane.travelMs)} ${ms($lane.departAtMs)} ease-in-out,
        ${breathe} 1.8s ${ms($lane.arriveAtMs)} ease-in-out infinite;
    `}
    img,
    canvas {
      display: block;
      animation: ${scanFlash} 260ms ${({ $lane }) => ms($lane.badgeAtMs - 60)} ease-out;
    }
    @media (prefers-reduced-motion: reduce) {
      animation: none;
      img,
      canvas {
        animation: none;
      }
    }
  `,
  Badge: styled.span<{ $atMs: number }>`
    position: absolute;
    left: 50%;
    bottom: 10px;
    width: 12px;
    height: 15px;
    border-radius: 2px;
    background: ${OFFICE_PALETTE.paper};
    box-shadow: inset 0 4px 0 ${OFFICE_PALETTE.glass};
    transform-origin: top center;
    animation: ${swingIn} 420ms ${({ $atMs }) => ms($atMs)} ease-out both;
    &::before {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 100%;
      width: 10px;
      height: 8px;
      margin-left: -5px;
      border: 1px solid ${OFFICE_PALETTE.glass};
      border-bottom: 0;
      border-radius: 5px 5px 0 0;
    }
    @media (prefers-reduced-motion: reduce) {
      animation: none;
      transform: translateX(-50%);
    }
  `,
  Surprise: styled.span<{ $lane: CommuterTimeline }>`
    position: absolute;
    left: 50%;
    bottom: calc(100% + 4px);
    padding: 2px 6px;
    border: 2px solid #1b1f27;
    background: #ffffff;
    color: #1b1f27;
    font-family: ${({ theme }) => theme.typography.fontFamily.pixel};
    font-size: 12px;
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    opacity: 0;
    ${({ $lane }) => css`
      animation:
        ${popIn} 260ms ${ms($lane.surpriseAtMs)} ease-out both,
        ${fadeOut} 200ms ${ms($lane.badgeAtMs - 200)} ease-in forwards;
    `}
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `,
  Role: styled.span<{ $atMs: number }>`
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border: 1px solid ${OFFICE_PALETTE.glass}99;
    border-radius: 999px;
    background: ${OFFICE_PALETTE.tagBackground};
    color: ${OFFICE_PALETTE.tagText};
    font-size: 11px;
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    white-space: nowrap;
    animation: ${popIn} 320ms ${({ $atMs }) => ms($atMs)} ease-out both;
    &::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${OFFICE_PALETTE.working};
    }
    @media (prefers-reduced-motion: reduce) {
      animation: none;
      transform: translateX(-50%);
    }
  `,
};

/** 픽셀 마을에서 끌려와 게이트에서 사원증과 역할을 받고 자리에 서는 동료 하나 */
export function Commuter({
  petId,
  role,
  lane,
}: {
  petId: string;
  role: string;
  lane: CommuterTimeline;
}) {
  return (
    <Styled.Commuter $lane={lane}>
      <Styled.Surprise $lane={lane}>!?</Styled.Surprise>
      <Styled.Role $atMs={lane.badgeAtMs + 160}>AI {role}</Styled.Role>
      <Styled.Body $lane={lane}>
        <PetPreview petId={petId} size={PET_SIZE} />
        <Styled.Badge $atMs={lane.badgeAtMs} />
      </Styled.Body>
    </Styled.Commuter>
  );
}
