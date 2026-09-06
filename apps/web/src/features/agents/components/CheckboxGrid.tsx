import styled from "styled-components";

export const CheckGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.x2};

  > :only-child {
    flex: 1 1 100%;
  }
`;

export const CheckChip = styled.label`
  position: relative;

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  span {
    display: block;
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x2}`};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    cursor: pointer;
  }

  input:checked + span {
    color: ${({ theme }) => theme.colors.text.positive};
    border-color: ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    box-shadow: inset 3px 0 ${({ theme }) => theme.colors.brand.primary};
  }
`;
