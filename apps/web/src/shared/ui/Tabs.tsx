import styled from "styled-components";

export type TabItem<TValue extends string> = { value: TValue; label: string; count?: number };

const Styled = {
  List: styled.div`
    display: flex;
    gap: 2px;
    overflow-x: auto;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.default};
  `,
  Tab: styled.button<{ $selected: boolean }>`
    min-height: 36px;
    padding: ${({ theme }) => `0 ${theme.space.x3}`};
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    border: 0;
    border-bottom: 2px solid
      ${({ $selected, theme }) => ($selected ? theme.colors.text.primary : "transparent")};
    background: transparent;
    color: ${({ $selected, theme }) =>
      $selected ? theme.colors.text.primary : theme.colors.text.muted};
    font-weight: ${({ $selected, theme }) =>
      $selected ? theme.typography.fontWeight.bold : theme.typography.fontWeight.medium};
    white-space: nowrap;
    cursor: pointer;
    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
  `,
};

/** 가로 탭 목록 */
export function Tabs<TValue extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: Array<TabItem<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  /** 탭 목록의 접근성 이름 */
  label: string;
}) {
  return (
    <Styled.List role="tablist" aria-label={label}>
      {items.map((item) => (
        <Styled.Tab
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          $selected={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && <span>{item.count}</span>}
        </Styled.Tab>
      ))}
    </Styled.List>
  );
}
