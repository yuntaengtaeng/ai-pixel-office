import type { ReactNode } from "react";

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
      return section.replace(
        /`?(file:\/\/\/[^\s<>()`]+?\.(?:md|markdown|html?|png|jpe?g|gif|webp|svg|bmp|pdf))\b(?!\.)`?/gi,
        (full: string, path: string, offset: number) => {
          if (section[offset - 1] === "(") return full;
          let label = path.replace(/^file:\/\//i, "");
          try {
            label = decodeURIComponent(label);
          } catch {
            // 잘못 인코딩된 경로도 링크 클릭 시 오류 안내를 표시할 수 있도록 원문을 유지
          }
          return `[${label}](${path})`;
        },
      );
    })
    .join("");
}
