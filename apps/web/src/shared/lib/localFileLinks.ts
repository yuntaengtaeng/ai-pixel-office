import type { ReactNode } from "react";

const LOCAL_FILE_EXTENSION =
  "(?:md|markdown|html?|png|jpe?g|gif|webp|svg|bmp|pdf|zip|txt|json|csv|log)";

function windowsPathToFileUrl(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const [drive, ...segments] = normalized.split("/");
  return `file:///${drive}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function posixPathToFileUrl(path: string): string {
  return `file://${path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

/** Runtime이 artifact 이벤트 없이 최종 답변에만 남긴 로컬 산출물 경로를 찾는다. */
export function extractLocalFilePaths(markdown: string): string[] {
  const paths = new Set<string>();
  for (const section of markdown.split(/(```[\s\S]*?```)/g).filter((_, index) => index % 2 === 0)) {
    const matches = section.matchAll(
      new RegExp(`([A-Za-z]:\\\\[^\\r\\n<>]*?\\.${LOCAL_FILE_EXTENSION})\\b(?!\\.)`, "gi"),
    );
    for (const match of matches) {
      paths.add(match[1].replace(/[`'"),.;:]+$/, ""));
    }
    const posixMatches = section.matchAll(
      new RegExp(`(^|[\\s(])(/(?:Users|home|tmp|private|var)/[^\\r\\n<>]*?\\.${LOCAL_FILE_EXTENSION})\\b(?!\\.)`, "gim"),
    );
    for (const match of posixMatches) {
      paths.add(match[2].replace(/[`'"),.;:]+$/, ""));
    }
  }
  return [...paths];
}

/** 링크 라벨에 남은 드라이브 문자 앞 슬래시와 감싼 백틱/따옴표를 정리한다. */
export function localLinkLabel(label: ReactNode): ReactNode {
  if (typeof label !== "string") return label;
  return label.replace(/^\/([A-Za-z]:[\\/])/, "$1").replace(/[`'"]+$/, "");
}

/** 마크다운 원문에 그대로 적힌(백틱으로 감싼 경우 포함) file:// 경로를 클릭 가능한 링크로 변환한다. */
export function linkifyLocalPaths(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((section, index) => {
      if (index % 2 === 1) return section;
      // CommonMark does not accept a raw Windows path as a link destination. Convert it
      // before ReactMarkdown parses the message so a click cannot fall through to app root.
      const normalizedLinks = section.replace(
        new RegExp(`\\]\\(([A-Za-z]:\\\\[^)\\r\\n]+?\\.${LOCAL_FILE_EXTENSION})\\)`, "gi"),
        (_full: string, path: string) => `](${windowsPathToFileUrl(path)})`,
      );
      const fileUrls = normalizedLinks.replace(
        new RegExp(`\`?(file:\\/\\/\\/[^\\s<>()\`]+?\\.${LOCAL_FILE_EXTENSION})\\b(?!\\.)\`?`, "gi"),
        (full: string, path: string, offset: number) => {
          if (normalizedLinks[offset - 1] === "(") return full;
          let label = path.replace(/^file:\/\//i, "");
          try {
            label = decodeURIComponent(label);
          } catch {
            // 잘못 인코딩된 경로도 링크 클릭 시 오류 안내를 표시할 수 있도록 원문을 유지
          }
          return `[${label}](${path})`;
        },
      );
      return fileUrls.replace(
        new RegExp(`\`?([A-Za-z]:\\\\[^\\s<>()\`]+?\\.${LOCAL_FILE_EXTENSION})\\b(?!\\.)\`?`, "gi"),
        (full: string, path: string, offset: number) => {
          const preceding = fileUrls[offset - 1] ?? "";
          const insideExistingLink = fileUrls.slice(Math.max(0, offset - 2), offset) === "](";
          if (["(", "[", "/"].includes(preceding) || insideExistingLink) {
            return full;
          }
          return `[${path}](${windowsPathToFileUrl(path)})`;
        },
      ).replace(
        new RegExp(`(^|[\\s(])(/(?:Users|home|tmp|private|var)/[^\\s<>()\`]+?\\.${LOCAL_FILE_EXTENSION})\\b(?!\\.)`, "gim"),
        (full: string, prefix: string, path: string, offset: number) => {
          const pathOffset = offset + prefix.length;
          if (fileUrls.slice(Math.max(0, pathOffset - 2), pathOffset) === "](") return full;
          return `${prefix}[${path}](${posixPathToFileUrl(path)})`;
        },
      );
    })
    .join("");
}
