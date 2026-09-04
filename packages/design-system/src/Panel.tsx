import styled, { css } from "styled-components";

export const panelStyles = css`
  border: 2px solid ${({ theme }) => theme.colors.border.default};
  background: ${({ theme }) => theme.colors.background.surface};
  box-shadow: ${({ theme }) => theme.shadow};
`;

export const Panel = styled.div`
  ${panelStyles}
`;
