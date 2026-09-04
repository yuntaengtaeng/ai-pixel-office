import styled from "styled-components";

export const SectionHeading = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme, $compact }) => ($compact ? theme.space.x3 : theme.space.x4)};

  h2 {
    margin: ${({ theme }) => theme.space.x1} 0 0;
    font-size: ${({ theme, $compact }) => ($compact ? theme.typography.fontSize.subtitle : theme.typography.fontSize.headingSm)};
    letter-spacing: -0.025em;
  }

  ${({ theme, $compact }) =>
    $compact &&
    `
    padding-bottom: ${theme.space.x3};
    border-bottom: 2px solid ${theme.colors.border.subtle};

    h2 {
      display: flex;
      align-items: center;
      gap: ${theme.space.x2};
      margin: 0;
    }
  `}
`;

export const SectionHeadingCount = styled.span`
  padding: ${({ theme }) => theme.space.x1} ${({ theme }) => theme.space.x2};
  background: ${({ theme }) => theme.colors.background.surfaceMuted};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
`;
