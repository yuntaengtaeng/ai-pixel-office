import styled, { type DefaultTheme } from "styled-components";
import { diffLines, type DiffLineKind } from "../lib/diffLines.ts";

function lineColors(
  theme: DefaultTheme,
  kind: DiffLineKind,
): { background: string; color: string } {
  switch (kind) {
    case "added":
      return {
        background: theme.colors.background.positiveSubtle,
        color: theme.colors.text.positive,
      };
    case "removed":
      return {
        background: theme.colors.background.negativeSubtle,
        color: theme.colors.text.negative,
      };
    case "hunk":
      return { background: theme.colors.background.surfaceRaised, color: theme.colors.text.muted };
    case "meta":
      return { background: "transparent", color: theme.colors.text.muted };
    default:
      return { background: "transparent", color: theme.colors.text.secondary };
  }
}

const Styled = {
  Code: styled.pre`
    margin: 0;
    max-height: 60vh;
    overflow: auto;
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.md};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    line-height: 1.55;
  `,
  Line: styled.span<{ $kind: DiffLineKind }>`
    display: block;
    min-width: max-content;
    padding: 0 ${({ theme }) => theme.space.x3};
    background: ${({ theme, $kind }) => lineColors(theme, $kind).background};
    color: ${({ theme, $kind }) => lineColors(theme, $kind).color};
    white-space: pre;
  `,
};

/** unified diff 보기 (더한 줄은 초록, 뺀 줄은 빨강) */
export function DiffView({ patch, label }: { patch: string; label: string }) {
  return (
    <Styled.Code aria-label={label} tabIndex={0}>
      {diffLines(patch).map((line, index) => (
        <Styled.Line key={index} $kind={line.kind}>
          {line.text || " "}
        </Styled.Line>
      ))}
    </Styled.Code>
  );
}
