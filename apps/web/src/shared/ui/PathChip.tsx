import styled from "styled-components";

const Styled = styled.span`
  max-width: 100%;
  min-height: 26px;
  padding: ${({ theme }) => `0 ${theme.space.x3}`};
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.x2};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border.strong};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  white-space: nowrap;
  text-overflow: ellipsis;
  svg {
    flex: none;
  }
`;

/** 폴더 아이콘과 경로 */
export function PathChip({ path, title }: { path: string; title?: string }) {
  return (
    <Styled title={title ?? path}>
      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.2l1.6 1.6H13A1.5 1.5 0 0 1 14.5 4.6v7.9A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5z"
        />
      </svg>
      {path}
    </Styled>
  );
}
