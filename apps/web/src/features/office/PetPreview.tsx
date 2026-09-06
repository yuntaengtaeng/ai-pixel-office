import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors } from "@ai-pixel-office/design-system";
import { getPet, getPetSpriteUrl, plotPet } from "@ai-pixel-office/pet";

const Styled = {
  Canvas: styled.canvas`
    image-rendering: pixelated;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
  `,
  Image: styled.img<{ $silhouette: boolean }>`
    display: block;
    image-rendering: pixelated;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    filter: ${({ $silhouette }) => ($silhouette ? "grayscale(1) brightness(0.7)" : "none")};
  `,
};

export function PetPreview({
  petId,
  size = 56,
  silhouette = false,
}: {
  petId: string;
  size?: number;
  silhouette?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!imageFailed) return;
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const scale = 3;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    context.fillStyle = colors.background.surfaceMuted;
    context.fillRect(0, 0, canvas.width, canvas.height);
    plotPet(getPet(petId), (x, y, width, height, color) => {
      context.fillStyle = silhouette ? colors.text.muted : color;
      context.fillRect((x + 1) * scale, (y + 1) * scale, width * scale, height * scale);
    });
  }, [imageFailed, petId, silhouette]);

  useEffect(() => setImageFailed(false), [petId]);

  if (!imageFailed) {
    return (
      <Styled.Image
        src={getPetSpriteUrl(petId)}
        width={54}
        height={54}
        style={{ width: size, height: size }}
        $silhouette={silhouette}
        onError={() => setImageFailed(true)}
        alt=""
        aria-hidden="true"
      />
    );
  }

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
