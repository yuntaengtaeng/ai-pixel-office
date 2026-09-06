import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Panel, TextArea, mediaQuery } from "@ai-pixel-office/design-system";
import type { KnowledgeDocument, Workspace } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { messageOf } from "../../shared/lib/errors.ts";
import { recordApi } from "./api.ts";
import { taskApi } from "../tasks/api.ts";
import { Link } from "react-router-dom";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { MarkdownContent } from "../../shared/ui/MarkdownContent.tsx";
import { useSelectedDocumentId } from "./hooks/useSelectedDocumentId.ts";

const Styled = {
  Toolbar: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.space.x2};
    margin-bottom: ${({ theme }) => theme.space.x4};
    input {
      min-width: 0;
      flex: 1;
    }
  `,
  Grid: styled.div`
    display: grid;
    grid-template-columns: minmax(220px, 0.55fr) minmax(0, 1.45fr);
    gap: ${({ theme }) => theme.space.x4};
    align-items: stretch;
    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  List: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x3};
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    align-content: start;
  `,
  Record: styled.button<{ $selected: boolean }>`
    padding: ${({ theme }) => theme.space.x3};
    border: 2px solid
      ${({ theme, $selected }) =>
        $selected ? theme.colors.border.strong : theme.colors.border.subtle};
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.background.surfaceMuted : theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.primary};
    text-align: left;
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
    cursor: pointer;
    span {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
  Editor: styled(Panel).attrs({ as: "form" })`
    padding: ${({ theme }) => theme.space.x5};
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
    position: sticky;
    top: ${({ theme }) => theme.space.x4};
    textarea {
      min-height: 360px;
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    }
  `,
  ViewMode: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 3px;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};

    button {
      padding: ${({ theme }) => theme.space.x2};
      border: 0;
      background: transparent;
      color: ${({ theme }) => theme.colors.text.muted};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      cursor: pointer;
    }

    button.selected {
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      color: ${({ theme }) => theme.colors.text.primary};
      box-shadow: 2px 2px 0 ${({ theme }) => theme.colors.shadow.default};
    }
  `,
  Preview: styled(MarkdownContent)`
    min-height: 360px;
    padding: ${({ theme }) => `${theme.space.x6} ${theme.space.x6}`};
    overflow-wrap: anywhere;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    line-height: 1.75;

    > :first-child,
    > div > :first-child {
      margin-top: 0;
    }
    > :last-child,
    > div > :last-child {
      margin-bottom: 0;
    }

    h1,
    h2,
    h3,
    h4 {
      margin: 1.6em 0 0.65em;
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

    li {
      margin: 0.35em 0;
    }

    li::marker {
      color: ${({ theme }) => theme.colors.text.positive};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
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

    @media ${mediaQuery.md} {
      padding: ${({ theme }) => theme.space.x4};
    }
  `,
  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};
  `,
  Hint: styled.p`
    margin: 0 0 ${({ theme }) => theme.space.x4};
    color: ${({ theme }) => theme.colors.text.muted};
  `,
  Source: styled.div`
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.positive};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};
    > div {
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
    }
    span {
      display: flex;
      gap: ${({ theme }) => theme.space.x2};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
    em {
      font-style: normal;
    }
    a {
      color: ${({ theme }) => theme.colors.text.positive};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
  `,
};

function markdownOf(document: KnowledgeDocument): string {
  return `---\nid: ${JSON.stringify(document.id)}\ntitle: ${JSON.stringify(document.title)}\nworkspaceId: ${JSON.stringify(document.workspaceId)}${document.taskId ? `\ntaskId: ${JSON.stringify(document.taskId)}` : ""}${document.runId ? `\nrunId: ${JSON.stringify(document.runId)}` : ""}\nreferenceTaskIds: ${JSON.stringify(document.referenceTaskIds)}\ncreatedAt: ${JSON.stringify(document.createdAt)}\nupdatedAt: ${JSON.stringify(document.updatedAt)}\n---\n\n${document.content}\n`;
}

function download(document: KnowledgeDocument) {
  const url = URL.createObjectURL(
    new Blob([markdownOf(document)], { type: "text/markdown;charset=utf-8" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = document.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RecordsPage({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [viewMode, setViewMode] = useState<"preview" | "edit">("edit");
  const records = useQuery({
    queryKey: ["knowledge-documents", workspace.id],
    queryFn: () => recordApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const { selectedId, select } = useSelectedDocumentId(records.data);
  const selected = records.data?.find((document) => document.id === selectedId);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return (records.data ?? []).filter(
      (document) =>
        !normalized ||
        `${document.title} ${document.content}`.toLocaleLowerCase("ko-KR").includes(normalized),
    );
  }, [query, records.data]);
  const sourceTask = tasks.data?.find((task) => task.id === selected?.taskId);
  useEffect(() => {
    setTitle(selected?.title ?? "");
    setContent(selected?.content ?? "");
    setViewMode(selected ? "preview" : "edit");
  }, [selected]);
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["knowledge-documents", workspace.id] });
  const save = useMutation({
    mutationFn: () =>
      selected
        ? recordApi.update(workspace.id, selected.id, { title: title.trim(), content })
        : recordApi.create({ workspaceId: workspace.id, title: title.trim(), content }),
    onSuccess: (document) => {
      select(document.id);
      setViewMode("preview");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => recordApi.remove(workspace.id, selected!.id),
    onSuccess: () => {
      select(undefined);
      refresh();
    },
  });
  const importRecord = useMutation({
    mutationFn: async (file: File) => recordApi.import(workspace.id, file.name, await file.text()),
    onSuccess: (document) => {
      select(document.id);
      refresh();
    },
  });
  const error = records.error ?? save.error ?? remove.error ?? importRecord.error;
  return (
    <BaseLayout>
      <PageHeader
        eyebrow="OFFICE ARCHIVE"
        title="자료실"
        action={
          <Button
            $variant="primary"
            onClick={() => select(undefined)}
          >
            + 새 문서
          </Button>
        }
      />
      <Styled.Hint>
        작업에서 얻은 결정과 결과를 Markdown으로 남기고 다시 찾아보세요. 파일은 내 컴퓨터에
        저장됩니다.
      </Styled.Hint>
      <Styled.Toolbar>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="문서와 작업 기록 검색"
        />
        <input
          ref={fileInput}
          type="file"
          accept=".md,text/markdown"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importRecord.mutate(file);
            event.currentTarget.value = "";
          }}
        />
        <Button $variant="secondary" type="button" onClick={() => fileInput.current?.click()}>
          MD 가져오기
        </Button>
      </Styled.Toolbar>
      {error && <ErrorBanner>{messageOf(error)}</ErrorBanner>}
      <Styled.Grid>
        <Styled.List>
          {visible.map((document) => (
            <Styled.Record
              key={document.id}
              type="button"
              $selected={document.id === selectedId}
              onClick={() => select(document.id)}
            >
              <strong>{document.title}</strong>
              <span>
                {new Date(document.updatedAt).toLocaleString("ko-KR")}
                {document.taskId ? " · 작업 연결됨" : ""}
              </span>
            </Styled.Record>
          ))}
          {!records.isPending && visible.length === 0 && query && (
            <Empty
              title="검색 결과가 없어요"
              action={
                <Button $variant="secondary" type="button" onClick={() => setQuery("")}>
                  검색어 지우기
                </Button>
              }
            >
              다른 검색어로 다시 시도해 보세요.
            </Empty>
          )}
          {!records.isPending && visible.length === 0 && !query && (
            <Empty
              title="아직 문서가 없어요"
              action={
                <Button $variant="primary" onClick={() => select(undefined)}>
                  + 새 문서
                </Button>
              }
            >
              작업에서 얻은 결정과 결과를 Markdown으로 남겨 보세요.
            </Empty>
          )}
        </Styled.List>
        <Styled.Editor
          onSubmit={(event) => {
            event.preventDefault();
            if (viewMode === "edit") save.mutate();
          }}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="문서 제목"
            readOnly={viewMode === "preview"}
            required
          />
          <Styled.ViewMode aria-label="문서 보기 방식">
            <button
              type="button"
              className={viewMode === "preview" ? "selected" : ""}
              onClick={() => setViewMode("preview")}
            >
              미리보기
            </button>
            <button
              type="button"
              className={viewMode === "edit" ? "selected" : ""}
              onClick={() => setViewMode("edit")}
            >
              편집
            </button>
          </Styled.ViewMode>
          {viewMode === "preview" ? (
            <Styled.Preview>{content.trim() || "_아직 작성된 내용이 없습니다._"}</Styled.Preview>
          ) : (
            <TextArea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={"# 결정 사항\n\n작업에서 알게 된 내용과 다음 할 일을 남겨 보세요."}
            />
          )}
          {selected?.taskId && (
            <Styled.Source>
              <div>
                <strong>이 문서의 출처</strong>
                <span>
                  <em>{sourceTask?.title ?? "삭제되었거나 찾을 수 없는 작업"}</em>
                  {selected.runId && <em>실행 세션 연결됨</em>}
                </span>
              </div>
              {sourceTask ? (
                <Link to={`/tasks/${selected.taskId}`}>작업 보기 →</Link>
              ) : (
                <small>원본 없음</small>
              )}
            </Styled.Source>
          )}
          <Styled.Actions>
            {selected && (
              <Button
                $variant="danger"
                type="button"
                onClick={async () => {
                  if (
                    await confirm({
                      title: "문서를 삭제할까요?",
                      description: `'${selected.title}' Markdown 파일이 내 컴퓨터에서 삭제됩니다.`,
                      confirmLabel: "문서 삭제",
                      tone: "danger",
                    })
                  )
                    remove.mutate();
                }}
                disabled={remove.isPending}
              >
                삭제
              </Button>
            )}
            {selected && (
              <Button $variant="secondary" type="button" onClick={() => download(selected)}>
                MD 내보내기
              </Button>
            )}
            {viewMode === "edit" && (
              <Button $variant="primary" disabled={!title.trim() || save.isPending}>
                {save.isPending ? "저장 중…" : "문서 저장"}
              </Button>
            )}
          </Styled.Actions>
        </Styled.Editor>
      </Styled.Grid>
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
  );
}
