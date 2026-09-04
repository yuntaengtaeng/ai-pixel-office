import styled from "styled-components";
import { panelStyles } from "@ai-pixel-office/design-system";

export const OfficeCard = styled.section`
  ${panelStyles}
  margin-bottom: ${({ theme }) => theme.space.x6};
  padding: ${({ theme }) => theme.space.x5};

  @media ${({ theme }) => theme.mediaQuery.md} {
    padding: ${({ theme }) => theme.space.x3};
  }
`;

export const OfficeLoading = styled.div`
  display: grid;
  min-height: 360px;
  place-items: center;
  border: 3px solid ${({ theme }) => theme.colors.border.strong};
  background: ${({ theme }) => theme.colors.background.surfaceMuted};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
`;

export const LiveBadge = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.x2};
  padding: ${({ theme }) => theme.space.x2} ${({ theme }) => theme.space.x3};
  border: 1px solid ${({ theme }) => theme.colors.border.positive};
  background: ${({ theme }) => theme.colors.background.positiveSubtle};
  color: ${({ theme }) => theme.colors.text.positive};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
`;
