import styled from "styled-components";

export const TechnicalDetails = styled.details`
  margin: ${({ theme }) => theme.space.x3} 0;
  border-top: 1px dashed ${({ theme }) => theme.colors.border.subtle};
  border-bottom: 1px dashed ${({ theme }) => theme.colors.border.subtle};

  > summary {
    padding: ${({ theme }) => theme.space.x2} 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    cursor: pointer;
  }

  > div:last-child {
    padding-bottom: ${({ theme }) => theme.space.x3};
  }
`;
