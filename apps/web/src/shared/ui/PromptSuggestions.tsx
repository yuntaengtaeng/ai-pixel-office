import styled from "styled-components";

export const PromptSuggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.x1};
  margin-top: ${({ theme }) => theme.space.x1};

  button {
    padding: ${({ theme }) => theme.space.x1} ${({ theme }) => theme.space.x2};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surface};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    text-align: left;
    cursor: pointer;
  }

  button:hover {
    border-color: ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    color: ${({ theme }) => theme.colors.text.positive};
  }
`;
