import styled from "styled-components";
import { PETS } from "@ai-pixel-office/pet";
import { PetPreview } from "../../office/PetPreview.tsx";
import type { PetUnlockProgress } from "../pet-unlocks-api.ts";

const Styled = {
  PetChoice: styled.button<{ $selected: boolean; $locked: boolean }>`
    min-width: 0;
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x1}`};
    border: 2px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;

    ${({ $locked }) =>
      $locked &&
      `
        cursor: not-allowed;
      `}

    &:hover {
      border-color: ${({ theme }) => theme.colors.border.default};
    }

    ${({ $selected, theme }) =>
      $selected &&
      `
        border-color: ${theme.colors.border.positive};
        background: ${theme.colors.background.surfaceMuted};
        box-shadow: 3px 3px 0 ${theme.colors.border.positive};
      `}

    strong {
      margin-top: ${({ theme }) => theme.space.x1};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }

    span {
      margin-top: ${({ theme }) => theme.space.x1};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      color: ${({ theme }) => theme.colors.text.muted};
      overflow: hidden;
      white-space: nowrap;
      width: 100%;
    }

    small {
      min-height: 28px;
      margin-top: ${({ theme }) => theme.space.x1};
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      line-height: 1.3;
    }
  `,
  PetPortrait: styled.div`
    position: relative;

    > strong {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: ${({ theme }) => theme.colors.text.primary};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.xl};
      margin: 0;
      text-shadow: 1px 1px 0 ${({ theme }) => theme.colors.background.surface};
    }
  `,
};

export function PetChoice({
  pet,
  selected,
  onSelect,
  unlock,
}: {
  pet: (typeof PETS)[number];
  selected: boolean;
  onSelect: (id: string) => void;
  unlock?: PetUnlockProgress;
}) {
  const isMissionPet = pet.unlock !== undefined;
  const locked = isMissionPet && unlock?.unlocked !== true;
  let unlockLabel: string | undefined;
  if (isMissionPet) {
    unlockLabel = "해금 조건 확인 중";
    if (unlock) unlockLabel = unlock.hint;
    if (unlock?.unlocked) unlockLabel = "해금 완료";
  }
  return (
    <Styled.PetChoice
      type="button"
      $selected={selected}
      $locked={locked}
      aria-disabled={locked}
      onClick={() => {
        if (!locked) onSelect(pet.id);
      }}
      title={locked ? unlock?.hint : `${pet.breed}, ${pet.accessories.join(", ")}`}
    >
      <Styled.PetPortrait>
        <PetPreview petId={pet.id} size={54} silhouette={locked} />
        {locked && <strong aria-hidden="true">?</strong>}
      </Styled.PetPortrait>
      <strong>{pet.name}</strong>
      <span>{locked ? "미지의 동료" : pet.breed}</span>
      {unlockLabel && <small>{unlockLabel}</small>}
    </Styled.PetChoice>
  );
}
