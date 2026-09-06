import type { TaskStatus } from "@ai-pixel-office/domain/entities";
import type { Container } from "pixi.js";
import { getPetAnimation, type PetAnimationStatus } from "@ai-pixel-office/pet";

export type AnimatedPet = {
  item: Container;
  baseX: number;
  baseY: number;
  status: TaskStatus | "idle";
  phase: number;
  petId?: string;
};

export function animatePet(character: AnimatedPet, time: number, deltaTime: number): void {
  character.item.position.set(character.baseX, character.baseY);
  character.item.rotation = 0;
  character.item.scale.set(1);
  const frame = getPetAnimation(character.petId ?? "").frame({
    status: character.status as PetAnimationStatus,
    time,
    phase: character.phase,
  });
  character.item.x += frame.x;
  character.item.y += frame.y;
  character.item.rotation = frame.rotation * (character.status === "done" ? deltaTime : 1);
  character.item.scale.set(frame.scaleX, frame.scaleY);
}
