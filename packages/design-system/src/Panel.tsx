import styled, { css } from "styled-components";

export const panelStyles = css`
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  border-radius: ${({ theme }) => theme.radius.xl};
  background: ${({ theme }) => theme.colors.background.surface};
`;

export const Panel = styled.div`
  ${panelStyles}
`;
