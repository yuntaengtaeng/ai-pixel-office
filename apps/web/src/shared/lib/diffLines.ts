export type DiffLineKind = "added" | "removed" | "hunk" | "meta" | "context";

export type DiffLine = { kind: DiffLineKind; text: string };

const META_PREFIXES = [
  "diff --git",
  "index ",
  "--- ",
  "+++ ",
  "new file mode",
  "deleted file mode",
  "similarity",
  "rename ",
];

/** unified diff를 줄마다 종류와 함께 나눔 (파일 머리글은 meta, @@는 hunk) */
export function diffLines(patch: string): DiffLine[] {
  return patch
    .replace(/\n$/, "")
    .split("\n")
    .map((text): DiffLine => {
      if (META_PREFIXES.some((prefix) => text.startsWith(prefix))) return { kind: "meta", text };
      if (text.startsWith("@@")) return { kind: "hunk", text };
      if (text.startsWith("+")) return { kind: "added", text };
      if (text.startsWith("-")) return { kind: "removed", text };
      return { kind: "context", text };
    });
}

/** 더한 줄과 뺀 줄 수 */
export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((line) => line.kind === "added").length,
    removed: lines.filter((line) => line.kind === "removed").length,
  };
}
