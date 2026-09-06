import { getPet } from "./catalog.ts";

/** Returns the canonical runtime sprite URL for a catalog pet. */
export function getPetSpriteUrl(petId: string, seed?: number): string {
  return `/pets/baked/${getPet(petId, seed).id}.png`;
}
