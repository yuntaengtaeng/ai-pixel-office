import { Link } from "react-router-dom";
import styled from "styled-components";
import type { Agent } from "@ai-pixel-office/domain/entities";
import { RUNTIME } from "../../../shared/config/presentation.ts";
import { PetPreview } from "../../office/PetPreview.tsx";

const Styled = {
  Badge: styled(Link)`
    display: grid;
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.xl};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    &:hover,
    &:focus-visible {
      border-color: ${({ theme }) => theme.colors.border.focus};
      outline: none;
    }
  `,
  Band: styled.div<{ $color: string }>`
    height: 28px;
    display: grid;
    place-items: center;
    background: ${({ $color }) => $color};
    &::after {
      content: "";
      width: 32px;
      height: 6px;
      border-radius: ${({ theme }) => theme.radius.pill};
      background: ${({ theme }) => theme.colors.background.canvas};
    }
  `,
  Body: styled.div`
    display: grid;
    justify-items: center;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x4};
    text-align: center;
  `,
  Photo: styled.div`
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
  `,
  Name: styled.strong`
    font-family: ${({ theme }) => theme.typography.fontFamily.pixel};
    font-size: ${({ theme }) => theme.typography.fontSize.lead};
  `,
  Role: styled.span`
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  `,
  Meta: styled.span`
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
};

/** 조직도의 동료 사원증 (런타임 색 띠, 캐릭터, 이름, 역할, 스킬 수) */
export function ColleagueBadge({ agent }: { agent: Agent }) {
  return (
    <Styled.Badge to={`/agents/${agent.id}`} aria-label={`${agent.name} ${agent.role}`}>
      <Styled.Band $color={RUNTIME[agent.model].color} aria-hidden="true" />
      <Styled.Body>
        <Styled.Photo>
          {agent.avatarId && <PetPreview petId={agent.avatarId} size={56} />}
        </Styled.Photo>
        <Styled.Name>{agent.name}</Styled.Name>
        <Styled.Role>{agent.role}</Styled.Role>
        <Styled.Meta>
          {RUNTIME[agent.model].label} · 스킬 {agent.skillIds.length}개
        </Styled.Meta>
      </Styled.Body>
    </Styled.Badge>
  );
}
