import styled from "styled-components";

export const FilterBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.x1};
  overflow-x: auto;
  padding: ${({ theme }) => `${theme.space.x1} 0`};

  button {
    flex: 0 0 auto;
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x2}`};
    border: 1px solid ${({ theme }) => theme.colors.shadow.default};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    cursor: pointer;
  }

  button[aria-pressed="true"] {
    border-color: ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.brand.primary};
    color: ${({ theme }) => theme.colors.background.surface};
  }

  b {
    margin-left: ${({ theme }) => theme.space.x1};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  }
`;
