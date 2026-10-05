import styled from "styled-components";
import type { Agent, Skill } from "@ai-pixel-office/domain/entities";
import { SKILL_SOURCE_LABEL } from "../utils/skillLibraryView.ts";

const Styled = {
  List: styled.ul`
    display: grid;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.xl};
    background: ${({ theme }) => theme.colors.background.surface};
    overflow: hidden;
  `,
  Row: styled.button<{ $selected: boolean }>`
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.space.x3};
    align-items: start;
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x4}`};
    border: 0;
    border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.background.surfaceRaised : "transparent"};
    color: inherit;
    text-align: left;
    cursor: pointer;
    li:first-child > & {
      border-top: 0;
    }
    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.border.focus};
      outline-offset: -2px;
    }
  `,
  Name: styled.strong`
    display: block;
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
  `,
  Description: styled.span`
    display: -webkit-box;
    margin-top: ${({ theme }) => theme.space.x1};
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    line-height: 1.45;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  `,
  Meta: styled.span`
    display: grid;
    justify-items: end;
    gap: ${({ theme }) => theme.space.x1};
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    white-space: nowrap;
  `,
  Source: styled.span`
    padding: ${({ theme }) => `2px ${theme.space.x2}`};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.pill};
    color: ${({ theme }) => theme.colors.text.secondary};
  `,
};

/** 스킬 목록 (이름, 설명, 출처, 쓰는 동료 수) */
export function SkillList({
  skills,
  usage,
  selectedId,
  onSelect,
}: {
  skills: Skill[];
  usage: Map<string, Agent[]>;
  selectedId?: string;
  onSelect: (skillId: string) => void;
}) {
  return (
    <Styled.List aria-label="스킬 목록">
      {skills.map((skill) => (
        <li key={skill.id}>
          <Styled.Row
            type="button"
            $selected={skill.id === selectedId}
            aria-current={skill.id === selectedId}
            onClick={() => onSelect(skill.id)}
          >
            <span>
              <Styled.Name>{skill.id}</Styled.Name>
              <Styled.Description>{skill.description}</Styled.Description>
            </span>
            <Styled.Meta>
              <Styled.Source>{SKILL_SOURCE_LABEL[skill.source]}</Styled.Source>
              <span>동료 {usage.get(skill.id)?.length ?? 0}명</span>
            </Styled.Meta>
          </Styled.Row>
        </li>
      ))}
    </Styled.List>
  );
}
