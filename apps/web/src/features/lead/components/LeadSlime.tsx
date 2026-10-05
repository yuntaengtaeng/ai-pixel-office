import styled, { keyframes } from "styled-components";
import { SLIME_PALETTE, SLIME_POSE_LABEL, SLIME_POSES } from "../sprites/slime.ts";
import type { LeadPose } from "../utils/leadView.ts";

const breathe = keyframes`
  0%, 100% { transform: scale(1, 1); }
  50% { transform: scale(1.06, 0.92); }
`;

const Sprite = styled.svg<{ $breathing: boolean }>`
  flex: none;
  image-rendering: pixelated;
  transform-origin: 50% 100%;
  animation: ${({ $breathing }) => ($breathing ? breathe : "none")} 2.4s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/** 팀장 슬라임 (상태에 따라 모양이 바뀌는 16x16 픽셀 캐릭터) */
export function LeadSlime({
  pose,
  size,
  breathing = false,
}: {
  pose: LeadPose;
  size: number;
  breathing?: boolean;
}) {
  const pixels = SLIME_POSES[pose].flatMap((row, y) =>
    [...row].flatMap((key, x) => {
      const color = SLIME_PALETTE[key];
      return color ? [{ x, y, color }] : [];
    }),
  );
  return (
    <Sprite
      $breathing={breathing}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      role="img"
      aria-label={SLIME_POSE_LABEL[pose]}
    >
      {pixels.map((pixel) => (
        <rect
          key={`${pixel.x}-${pixel.y}`}
          x={pixel.x}
          y={pixel.y}
          width={1}
          height={1}
          fill={pixel.color}
        />
      ))}
    </Sprite>
  );
}
