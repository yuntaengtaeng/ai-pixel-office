import type { ReactNode } from "react";
import styled from "styled-components";

const Styled = {
  List: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
    align-content: start;
  `,
  Group: styled.section`
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
    h3 {
      display: flex;
      justify-content: space-between;
      margin: 0;
      padding: ${({ theme }) => `0 ${theme.space.x1}`};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    }
    ul {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
  Item: styled.button<{ $selected: boolean }>`
    width: 100%;
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid
      ${({ theme, $selected }) =>
        $selected ? theme.colors.border.strong : theme.colors.border.subtle};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.background.surfaceMuted : theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.primary};
    text-align: left;
    cursor: pointer;
    small {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.border.focus};
      outline-offset: -2px;
    }
  `,
};

/** 고를 수 있는 항목 목록 (Group으로 묶고 Item을 고름) */
export function SelectableList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Styled.List role="navigation" aria-label={label}>
      {children}
    </Styled.List>
  );
}

/** 제목과 개수가 있는 항목 묶음 */
function SelectableListGroup({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Styled.Group aria-label={title}>
      <h3>
        <span>{title}</span>
        {count !== undefined && <span>{count}</span>}
      </h3>
      <ul>{children}</ul>
    </Styled.Group>
  );
}

/** 고를 수 있는 항목 하나 (제목과 보조 설명은 children으로) */
function SelectableListItem({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <Styled.Item type="button" $selected={selected} aria-current={selected} onClick={onSelect}>
        {children}
      </Styled.Item>
    </li>
  );
}

SelectableList.Group = SelectableListGroup;
SelectableList.Item = SelectableListItem;
