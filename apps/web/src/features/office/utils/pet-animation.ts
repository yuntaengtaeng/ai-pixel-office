import type { TaskStatus } from "@ai-pixel-office/domain/entities";
import type { Container } from "pixi.js";
import { getPetAnimation, type PetAnimationStatus } from "@ai-pixel-office/pet";
import { positionOnWalk, type PetWalk } from "./petWalk.ts";

export type AnimatedPet = {
  item: Container;
  baseX: number;
  baseY: number;
  status: TaskStatus | "idle";
  phase: number;
  petId?: string;
  /** 이전 자리에서 새 자리로 걷는 중이면 경로 (도착하면 없어짐) */
  walk?: PetWalk;
};

/** 한 프레임 갱신 (걷는 중이면 경로 위 위치와 걷기 동작, 아니면 자리에서 상태 동작) */
export function animatePet(
  character: AnimatedPet,
  time: number,
  deltaTime: number,
  nowMs: number,
): void {
  let walking = false;
  if (character.walk) {
    const position = positionOnWalk(character.walk, nowMs);
    character.baseX = position.x;
    character.baseY = position.y;
    walking = !position.arrived;
    if (position.arrived) character.walk = undefined;
  }
  const frame = getPetAnimation(character.petId ?? "").frame({
    status: character.status as PetAnimationStatus,
    time,
    phase: character.phase,
    walking,
  });
  character.item.position.set(character.baseX + frame.x, character.baseY + frame.y);
  character.item.rotation = frame.rotation * (character.status === "done" ? deltaTime : 1);
  character.item.scale.set(frame.scaleX, frame.scaleY);
}
