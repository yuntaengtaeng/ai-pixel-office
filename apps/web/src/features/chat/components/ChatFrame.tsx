import { Panel } from "@ai-pixel-office/design-system";
import styled from "styled-components";

export const ChatFrame = styled(Panel)<{ $muted?: boolean }>`
  height: 100%;
  padding: ${({ theme }) => theme.space.x4};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.x4};
  overflow: hidden;
  background: ${({ $muted, theme }) => ($muted ? theme.colors.background.surfaceMuted : undefined)};
`;

export const EndedTag = styled.span`
  padding: 1px ${({ theme }) => theme.space.x1};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  background: ${({ theme }) => theme.colors.background.surfaceMuted};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`;

export const ChatHeader = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.x2};
  padding-bottom: ${({ theme }) => theme.space.x3};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  }

  span {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
  }
`;

export const ChatHeaderActions = styled.div`
  margin-left: auto;
  display: flex;
  gap: ${({ theme }) => theme.space.x2};
`;

export const ChatScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  align-content: start;
  gap: ${({ theme }) => theme.space.x3};
`;

export const ChatInputBar = styled.form`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.x2};
  padding: ${({ theme }) => theme.space.x2} ${({ theme }) => theme.space.x3};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.radius.xl};
  background: ${({ theme }) => theme.colors.background.surfaceRaised};

  textarea {
    flex: 1;
    min-height: 24px;
    max-height: 160px;
    border: 0;
    background: transparent;
    padding: ${({ theme }) => theme.space.x2} 0;
    resize: none;

    &:focus {
      border: 0;
      box-shadow: none;
    }
  }
`;
