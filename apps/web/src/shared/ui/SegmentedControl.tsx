import styled from "styled-components";

export const SegmentedControl = styled.div`
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  padding: 3px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  background: ${({ theme }) => theme.colors.background.surfaceMuted};

  button {
    min-height: 44px;
    padding: ${({ theme }) => theme.space.x2};
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.muted};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    cursor: pointer;
  }

  button.selected,
  button[aria-checked="true"],
  button[aria-pressed="true"] {
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.primary};
    box-shadow: 2px 2px 0 ${({ theme }) => theme.colors.shadow.default};
  }
`;
