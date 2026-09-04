import styled from "styled-components";

export const Surface = styled.section`
  background: ${({ theme }) => theme.colors.background.surface};
  border: 2px solid ${({ theme }) => theme.colors.border.default};
  box-shadow: ${({ theme }) => theme.shadow};
`;
