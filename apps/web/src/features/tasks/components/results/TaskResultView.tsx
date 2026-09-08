import styled from "styled-components";
import { MarkdownContent } from "../../../../shared/ui/MarkdownContent.tsx";
import { extractLocalFilePaths } from "../../../../shared/lib/localFileLinks.ts";
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

const Artifact = styled.button`
  width: 100%;
  display: flex;
  text-align: left;
  cursor: pointer;
  gap: ${({ theme }) => theme.space.x3};
  margin-top: ${({ theme }) => theme.space.x3};
  padding: ${({ theme }) => theme.space.x3};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  background: ${({ theme }) => theme.colors.background.surfaceRaised};
  color: inherit;

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
  const pathArtifacts = (result.artifacts ?? []).filter(
    (artifact): artifact is typeof artifact & { path: string } => Boolean(artifact.path),
  );
  const basenameCounts = new Map<string, number>();
  for (const artifact of pathArtifacts) {
    const basename = artifact.path.split(/[\\/]/).pop() ?? artifact.name;
    basenameCounts.set(basename, (basenameCounts.get(basename) ?? 0) + 1);
  }
  const artifactPaths = Object.fromEntries(
    pathArtifacts.flatMap((artifact) => {
      const basename = artifact.path.split(/[\\/]/).pop() ?? artifact.name;
      return [
        [artifact.name, artifact.path],
        [artifact.path, artifact.path],
        ...(basenameCounts.get(basename) === 1 ? [[basename, artifact.path]] : []),
      ];
    }),
  );
  const recordedPaths = new Set(pathArtifacts.map((artifact) => artifact.path.toLowerCase()));
  // Claude may mention a generated file only in its final prose, without an artifact event.
  // Surface those paths through the same trusted desktop open-path boundary as recorded artifacts.
  const inferredArtifacts = extractLocalFilePaths(result.summary)
    .filter((path) => !recordedPaths.has(path.toLowerCase()))
    .map((path) => ({
      name: path.split(/[\\/]/).pop() ?? path,
      path,
      type: "file",
      url: undefined,
    }));
  const visibleArtifacts = [...(result.artifacts ?? []), ...inferredArtifacts];

  return (
    <>
      <MarkdownResult $size={size} artifactPaths={artifactPaths}>
        {result.summary}
      </MarkdownResult>
      {visibleArtifacts.map((artifact) => (
        <Artifact
          key={artifact.name}
          type="button"
          disabled={!artifact.url && (!artifact.path || !window.pixelOffice)}
          title={artifact.path ? "파일 열기" : artifact.url ? "링크 열기" : undefined}
          onClick={() => {
            if (artifact.path && window.pixelOffice) {
              void window.pixelOffice.openPath(artifact.path);
            } else if (artifact.url) {
              window.open(artifact.url, "_blank", "noopener,noreferrer");
            }
          }}
        >
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
