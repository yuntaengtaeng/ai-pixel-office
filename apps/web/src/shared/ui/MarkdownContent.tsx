import { useState, type ComponentProps, type MouseEvent } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import styled from "styled-components";
import { linkifyLocalPaths, localLinkLabel } from "../lib/localFileLinks.ts";

const Root = styled.div`
  line-height: 1.75;
  overflow-wrap: anywhere;

  > :first-child {
    margin-top: 0;
  }
  > :last-child {
    margin-bottom: 0;
  }

  h1,
  h2,
  h3,
  h4 {
    margin: 1.5em 0 0.6em;
    color: ${({ theme }) => theme.colors.text.primary};
    line-height: 1.35;
    letter-spacing: -0.025em;
  }
  h1 {
    font-size: ${({ theme }) => theme.typography.fontSize.heading2xl};
  }
  h2 {
    font-size: ${({ theme }) => theme.typography.fontSize.headingMd};
  }
  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.subtitle};
  }
  h4 {
    font-size: ${({ theme }) => theme.typography.fontSize.lead};
  }
  h1,
  h2 {
    padding-bottom: ${({ theme }) => theme.space.x2};
    border-bottom: 2px solid ${({ theme }) => theme.colors.border.subtle};
  }

  p {
    margin: 0.75em 0;
  }
  ul,
  ol {
    margin: 0.75em 0;
    padding-left: ${({ theme }) => theme.space.x6};
  }
  ul {
    list-style: disc outside;
  }
  ol {
    list-style: decimal outside;
  }
  ul ul {
    list-style-type: circle;
  }
  ul ul ul {
    list-style-type: square;
  }
  li {
    display: list-item;
    margin: 0.35em 0;
  }
  li::marker {
    color: ${({ theme }) => theme.colors.text.positive};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  }
  li > p {
    margin: 0.25em 0;
  }

  a {
    color: ${({ theme }) => theme.colors.text.positive};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  strong {
    color: ${({ theme }) => theme.colors.text.primary};
  }
  blockquote {
    margin: ${({ theme }) => `${theme.space.x4} 0`};
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x4}`};
    border-left: 4px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    color: ${({ theme }) => theme.colors.text.secondary};
  }
  code {
    padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x1}`};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: 0.9em;
  }
  pre {
    margin: ${({ theme }) => `${theme.space.x4} 0`};
    padding: ${({ theme }) => theme.space.x4};
    overflow: auto;
    border: 2px solid ${({ theme }) => theme.colors.border.strong};
    background: ${({ theme }) => theme.colors.brand.primaryDark};
    color: ${({ theme }) => theme.colors.text.inverse};
    line-height: 1.55;
  }
  pre code {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
  }
  table {
    width: 100%;
    margin: ${({ theme }) => `${theme.space.x4} 0`};
    border-collapse: collapse;
  }
  th,
  td {
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x3}`};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    text-align: left;
  }
  th {
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    color: ${({ theme }) => theme.colors.text.primary};
  }
  hr {
    margin: ${({ theme }) => `${theme.space.x6} 0`};
    border: 0;
    border-top: 2px dashed ${({ theme }) => theme.colors.border.default};
  }
`;

const LinkNotice = styled.p`
  color: ${({ theme }) => theme.colors.text.negative};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};
`;

export function MarkdownContent({
  children,
  artifactPaths = {},
  ...props
}: ComponentProps<typeof Root> & { artifactPaths?: Record<string, string> }) {
  const [linkNotice, setLinkNotice] = useState<string>();
  const openLink = async (event: MouseEvent<HTMLAnchorElement>, href?: string) => {
    if (!href || href.startsWith("#") || /^https?:\/\//i.test(href)) return;
    event.preventDefault();
    setLinkNotice(undefined);
    let decodedHref: string;
    try {
      decodedHref = decodeURIComponent(href)
        .replace(/^file:\/\//i, "")
        .replace(/[`'"]+$/, "");
    } catch {
      setLinkNotice("파일 경로 형식이 올바르지 않아요");
      return;
    }
    if (/^\/[A-Za-z]:[\\/]/.test(decodedHref)) decodedHref = decodedHref.slice(1);
    const artifactPath =
      artifactPaths[href] ??
      artifactPaths[decodedHref] ??
      artifactPaths[decodedHref.split(/[\\/]/).pop() ?? ""] ??
      (/^(?:[A-Za-z]:[\\/]|\/)/.test(decodedHref) ? decodedHref : undefined);
    if (!artifactPath) {
      setLinkNotice("파일 경로를 확인할 수 없어요");
      return;
    }
    if (!window.pixelOffice) {
      setLinkNotice("로컬 파일은 데스크톱 앱에서 열 수 있어요");
      return;
    }
    try {
      const result = await window.pixelOffice.openPath(artifactPath);
      setLinkNotice(result.ok ? undefined : result.message || "파일을 열 수 없어요");
    } catch {
      setLinkNotice("파일을 열 수 없어요");
    }
  };

  return (
    <Root {...props}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) =>
          /^(?:file:\/\/|[A-Za-z]:[\\/]|\/)/i.test(url) ? url : defaultUrlTransform(url)
        }
        components={{
          a: ({ href, children: linkChildren }) => (
            <a
              href={href}
              target={/^https?:\/\//i.test(href ?? "") ? "_blank" : undefined}
              rel={/^https?:\/\//i.test(href ?? "") ? "noreferrer" : undefined}
              onClick={(event) => void openLink(event, href)}
            >
              {localLinkLabel(linkChildren)}
            </a>
          ),
        }}
      >
        {linkifyLocalPaths(String(children ?? ""))}
      </ReactMarkdown>
      {linkNotice && <LinkNotice role="status">{linkNotice}</LinkNotice>}
    </Root>
  );
}
