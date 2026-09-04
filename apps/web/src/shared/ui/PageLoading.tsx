import styled from "styled-components";

export const PageLoading = styled.div`
  display: grid;
  min-height: 45vh;
  place-items: center;
  color: ${({ theme }) => theme.colors.text.muted};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
`;
