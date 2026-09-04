import { useEffect, useRef } from "react";
import { getPet, plotPet } from "./pets.ts";

export function PetPreview({ petId, size = 56 }: { petId: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const scale = 3;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#f8f2e7";
    context.fillRect(0, 0, canvas.width, canvas.height);
    plotPet(getPet(petId), (x, y, width, height, color) => {
      context.fillStyle = color;
      context.fillRect((x + 1) * scale, (y + 1) * scale, width * scale, height * scale);
    });
  }, [petId]);

  return (
    <canvas
      ref={ref}
      width={54}
      height={54}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
