import type { TaskStatus } from "@ai-pixel-office/domain/entities";
import type { Container } from "pixi.js";

export type AnimatedPet = {
  item: Container;
  baseX: number;
  baseY: number;
  status: TaskStatus | "idle";
  phase: number;
  petId?: string;
};

export function animatePet(character: AnimatedPet, time: number, deltaTime: number): void {
  const wave = Math.sin(time + character.phase);
  character.item.position.set(character.baseX, character.baseY);
  character.item.rotation = 0;
  character.item.scale.set(1);
  if (character.petId === "rabbit-yuzu") {
    if (character.status === "working") {
      character.item.x += Math.round(Math.sin(time * 5 + character.phase) * 2);
      character.item.y -= Math.round(Math.abs(Math.sin(time * 2.5 + character.phase)) * 4);
    } else if (character.status === "done") {
      character.item.y -= Math.round(Math.abs(wave) * 8);
      character.item.rotation = Math.sin(time * 2 + character.phase) * 0.07;
    } else if (character.status === "needs_review" || character.status === "needs_input")
      character.item.x += Math.round(Math.sin(time * 2.6 + character.phase) * 4);
    else character.item.y -= Math.round(Math.abs(Math.sin(time * 0.8 + character.phase)) * 3);
    return;
  }
  if (character.petId === "capybara-gamja") {
    character.item.scale.y = 1 + Math.sin(time * 0.35 + character.phase) * 0.015;
    if (character.status === "working")
      character.item.y += Math.round(Math.sin(time * 1.2 + character.phase));
    else if (character.status === "done")
      character.item.rotation = Math.sin(time * 0.7 + character.phase) * 0.025;
    return;
  }
  if (character.petId === "quokka-bangul") {
    character.item.rotation = Math.sin(time * 0.9 + character.phase) * 0.025;
    if (character.status === "working")
      character.item.y -= Math.round(Math.abs(Math.sin(time * 2 + character.phase)) * 3);
    else if (character.status === "done") {
      character.item.y -= Math.round(Math.abs(Math.sin(time * 1.7 + character.phase)) * 7);
      character.item.rotation = Math.sin(time * 3 + character.phase) * 0.08;
    } else if (character.status === "needs_review" || character.status === "needs_input")
      character.item.x += Math.round(Math.sin(time * 2 + character.phase) * 3);
    return;
  }
  if (character.status === "working") {
    character.item.x += Math.round(Math.sin(time * 3 + character.phase));
    character.item.y += Math.round(wave * 1.4);
  } else if (character.status === "done") {
    character.item.y -= Math.round(Math.abs(wave) * 5);
    character.item.rotation = Math.sin(time * 1.8 + character.phase) * 0.02 * deltaTime;
  } else if (character.status === "blocked" || character.status === "failed") {
    character.item.y += 3 + Math.round(wave * 0.5);
    character.item.rotation = -0.025;
  } else if (character.status === "needs_review" || character.status === "needs_input")
    character.item.y -= Math.round(Math.abs(wave) * 3);
  else if (character.status === "idle") {
    character.item.x += Math.round(Math.sin(time * 0.24 + character.phase) * 7);
    character.item.y -= Math.round(Math.abs(wave) * 1.5);
  } else character.item.y += Math.round(wave);
}
