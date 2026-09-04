import styled from "styled-components";

export const Surface = styled.section`
  background: ${({ theme }) => theme.colors.cream};
  border: 2px solid ${({ theme }) => theme.colors.muted};
  box-shadow: ${({ theme }) => theme.shadow};
`;
