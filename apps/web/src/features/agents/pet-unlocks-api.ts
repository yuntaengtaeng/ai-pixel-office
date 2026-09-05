import { post } from "../../shared/api/client.ts";

export type PetUnlockProgress = {
  petId: string;
  unlocked: boolean;
  progress: number;
  target: number;
  mission: string;
  hint: string;
};

export const petUnlockApi = {
  progress: (workspaceId: string) =>
    post<PetUnlockProgress[]>("/api/pet-unlocks/evaluate", { workspaceId }),
};
