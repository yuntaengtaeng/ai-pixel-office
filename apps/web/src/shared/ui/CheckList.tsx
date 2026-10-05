import styled from "styled-components";

const Styled = {
  List: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.space.x2};
  `,
  Item: styled.label<{ $checked: boolean }>`
    min-height: 30px;
    padding: ${({ theme }) => `0 ${theme.space.x3}`};
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    border: 1px ${({ $checked }) => ($checked ? "solid" : "dashed")}
      ${({ $checked, theme }) => ($checked ? theme.colors.brand.primary : theme.colors.border.strong)};
    border-radius: ${({ theme }) => theme.radius.pill};
    color: ${({ $checked, theme }) => ($checked ? theme.colors.brand.primary : theme.colors.text.secondary)};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    cursor: pointer;
    input {
      margin: 0;
    }
  `,
};

/** 켜고 끌 수 있는 값 목록 */
export function CheckList({
  values,
  checked,
  onToggle,
  label,
}: {
  values: string[];
  checked: string[];
  onToggle: (value: string, checked: boolean) => void;
  /** 목록의 접근성 이름 */
  label: string;
}) {
  return (
    <Styled.List role="group" aria-label={label}>
      {values.map((value) => {
        const isChecked = checked.includes(value);
        return (
          <Styled.Item key={value} $checked={isChecked}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(event) => onToggle(value, event.target.checked)}
            />
            {value}
          </Styled.Item>
        );
      })}
    </Styled.List>
  );
}
