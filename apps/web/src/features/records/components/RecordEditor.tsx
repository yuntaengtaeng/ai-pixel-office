import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Input, Panel, TextArea } from "@ai-pixel-office/design-system";
import type { KnowledgeDocument, Task } from "@ai-pixel-office/domain/entities";
import { recordApi } from "../api.ts";
import { markdownOf } from "../utils/recordMarkdown.ts";
import { RecordPreview } from "./RecordPreview.tsx";
import { useConfirmDialog } from "../../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";
import { ConfirmDialog } from "../../../shared/ui/FeedbackDialogs.tsx";
import { SegmentedControl } from "../../../shared/ui/SegmentedControl.tsx";

const Styled = {
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
  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};
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
    a {
      color: ${({ theme }) => theme.colors.text.positive};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
  `,
};

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

/** 기록 문서 읽기와 편집 (문서가 없으면 새 문서 작성) */
export function RecordEditor({
  workspaceId,
  document,
  sourceTask,
  onSaved,
  onRemoved,
}: {
  workspaceId: string;
  document?: KnowledgeDocument;
  /** 문서를 만든 기안서 (지워졌으면 없음) */
  sourceTask?: Task;
  onSaved: (documentId: string) => void;
  onRemoved: () => void;
}) {
  const { confirm, dialogProps } = useConfirmDialog();
  const [title, setTitle] = useState(document?.title ?? "");
  const [content, setContent] = useState(document?.content ?? "");
  const [viewMode, setViewMode] = useState<"preview" | "edit">(document ? "preview" : "edit");
  const save = useMutation({
    mutationFn: () =>
      document
        ? recordApi.update(workspaceId, document.id, { title: title.trim(), content })
        : recordApi.create({ workspaceId, title: title.trim(), content }),
    onSuccess: (saved) => {
      setViewMode("preview");
      onSaved(saved.id);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => recordApi.remove(workspaceId, id),
    onSuccess: onRemoved,
  });
  const error = save.error ?? remove.error;

  return (
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
        aria-label="문서 제목"
        readOnly={viewMode === "preview"}
        required
      />
      <SegmentedControl aria-label="문서 보기 방식">
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
      </SegmentedControl>
      {viewMode === "preview" ? (
        <RecordPreview>{content.trim() || "_아직 작성된 내용이 없습니다._"}</RecordPreview>
      ) : (
        <TextArea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          aria-label="문서 내용"
          placeholder={"# 결정 사항\n\n작업에서 알게 된 내용과 다음 할 일을 남겨 보세요."}
        />
      )}
      {document?.taskId && (
        <Styled.Source>
          <div>
            <strong>이 문서의 출처</strong>
            <span>
              {sourceTask?.title ?? "삭제되었거나 찾을 수 없는 기안서"}
              {document.runId && " · 실행 세션 연결됨"}
            </span>
          </div>
          {sourceTask ? (
            <Link to={`/tasks/${document.taskId}`}>기안서 보기 →</Link>
          ) : (
            <small>원본 없음</small>
          )}
        </Styled.Source>
      )}
      {error && <ErrorBanner>{messageOf(error)}</ErrorBanner>}
      <Styled.Actions>
        {document && (
          <Button
            $variant="danger"
            type="button"
            disabled={remove.isPending}
            onClick={async () => {
              if (
                await confirm({
                  title: "문서를 삭제할까요?",
                  description: `'${document.title}' Markdown 파일이 내 컴퓨터에서 삭제됩니다.`,
                  confirmLabel: "문서 삭제",
                  tone: "danger",
                })
              )
                remove.mutate(document.id);
            }}
          >
            삭제
          </Button>
        )}
        {document && (
          <Button $variant="secondary" type="button" onClick={() => download(document)}>
            MD 내보내기
          </Button>
        )}
        {viewMode === "edit" && (
          <Button $variant="primary" disabled={!title.trim() || save.isPending}>
            {save.isPending ? "저장 중…" : "문서 저장"}
          </Button>
        )}
      </Styled.Actions>
      <ConfirmDialog {...dialogProps} />
    </Styled.Editor>
  );
}
