export { PETS, UNLOCKABLE_PETS, getPet, isPetId } from "./catalog.ts";
export type { Accessory, EarShape, Pattern, PetDesign, PetSpecies } from "./catalog.ts";
export { plotPet } from "./procedural-renderer.ts";
export type { PixelPlotter } from "./procedural-renderer.ts";
export { createPet, PetActor } from "./actor.ts";
export type {
  CreatePetOptions,
  PetActorSnapshot,
  PetDirection,
  PetMotion,
  PetPosition,
} from "./actor.ts";
