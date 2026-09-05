import styled from "styled-components";
import { MarkdownContent } from "../../../../shared/ui/MarkdownContent.tsx";
import type { TaskDetail } from "../../api.ts";

const MarkdownResult = styled(MarkdownContent)<{
  $size?: "default" | "compact" | "small";
}>`
  font-size: ${({ $size }) => ($size === "compact" ? "12px" : $size === "small" ? "11px" : "14px")};
  line-height: 1.75;

  h1,
  h2,
  h3 {
    margin: 1.25em 0 0.55em;
    color: ${({ theme }) => theme.colors.text.primary};
    line-height: 1.35;
  }

  h1 {
    padding-bottom: ${({ theme }) => theme.space.x2};
    border-bottom: 2px solid ${({ theme }) => theme.colors.border.subtle};
    font-size: ${({ theme }) => theme.typography.fontSize.headingXl};
  }

  h2 {
    font-size: ${({ theme }) => theme.typography.fontSize.xl};
  }
  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.lead};
  }
  p {
    margin: 0.7em 0;
  }

  code {
    padding: ${({ theme }) => theme.space.x1};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  }

  pre {
    padding: ${({ theme }) => theme.space.x3};
    overflow: auto;
    border: 2px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.semantic.info};
    color: ${({ theme }) => theme.colors.text.inverse};
  }

  pre code {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
  }

  blockquote {
    margin-left: 0;
    padding-left: ${({ theme }) => theme.space.x3};
    border-left: 4px solid ${({ theme }) => theme.colors.border.positive};
    color: ${({ theme }) => theme.colors.text.secondary};
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: ${({ theme }) => theme.space.x2};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    text-align: left;
  }
`;

const Artifact = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.x3};
  margin-top: ${({ theme }) => theme.space.x3};
  padding: ${({ theme }) => theme.space.x3};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  background: ${({ theme }) => theme.colors.background.surfaceRaised};

  div {
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
  }
  small {
    color: ${({ theme }) => theme.colors.text.muted};
  }
`;

export function TaskResultView({
  result,
  size = "default",
}: {
  result: NonNullable<TaskDetail["result"]>;
  size?: "default" | "compact" | "small";
}) {
  return (
    <>
      <MarkdownResult $size={size}>{result.summary}</MarkdownResult>
      {result.artifacts?.map((artifact) => (
        <Artifact key={artifact.name}>
          <span>▤</span>
          <div>
            <strong>{artifact.name}</strong>
            <small>{artifact.path ?? artifact.url ?? artifact.type}</small>
          </div>
        </Artifact>
      ))}
    </>
  );
}
