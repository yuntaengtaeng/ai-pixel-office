import { useEffect, useRef } from "react";
import styled from "styled-components";
import { colors } from "@ai-pixel-office/design-token";
import { getPet, plotPet } from "@ai-pixel-office/pet";

const Styled = {
  Canvas: styled.canvas`
    image-rendering: pixelated;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
  `,
};

export function PetPreview({ petId, size = 56 }: { petId: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const scale = 3;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    context.fillStyle = colors.background.surfaceMuted;
    context.fillRect(0, 0, canvas.width, canvas.height);
    plotPet(getPet(petId), (x, y, width, height, color) => {
      context.fillStyle = color;
      context.fillRect((x + 1) * scale, (y + 1) * scale, width * scale, height * scale);
    });
  }, [petId]);

  return (
    <Styled.Canvas
      ref={ref}
      width={54}
      height={54}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
