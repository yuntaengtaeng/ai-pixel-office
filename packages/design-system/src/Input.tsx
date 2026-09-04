import styled, { css } from "styled-components";

const controlStyles = css`
  width: 100%;
  padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
  border: 2px solid ${({ theme }) => theme.colors.border.default};
  border-radius: ${({ theme }) => theme.radius.sm};
  outline: none;
  background: ${({ theme }) => theme.colors.background.surfaceRaised};
  color: ${({ theme }) => theme.colors.text.primary};

  &:focus {
    border-color: ${({ theme }) => theme.colors.border.focus};
    box-shadow: 2px 2px 0 ${({ theme }) => theme.colors.shadow.focus};
  }

  &:disabled {
    opacity: 0.47;
    cursor: not-allowed;
  }
`;

export const Input = styled.input`
  ${controlStyles}
`;

export const TextArea = styled.textarea`
  ${controlStyles}
  min-height: 86px;
  resize: vertical;
`;

export const Select = styled.select`
  ${controlStyles}
`;
