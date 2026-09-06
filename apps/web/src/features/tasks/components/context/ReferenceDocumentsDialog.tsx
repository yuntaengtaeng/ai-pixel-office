import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, Input, useDialogIds } from "@ai-pixel-office/design-system";
import type { KnowledgeDocument } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";

const Styled = {
  Dialog: styled(Dialog)`
    .dialog-content {
      display: grid;
      gap: ${({ theme }) => theme.space.x4};
    }
    h2,
    p {
      margin: 0;
    }
    p {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
  `,
  List: styled.div`
    display: grid;
    max-height: 320px;
    overflow: auto;
    border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
  `,
  Row: styled.label`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x3};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
    cursor: pointer;
    input {
      width: 16px;
      height: 16px;
    }
    span {
      display: grid;
      min-width: 0;
      gap: ${({ theme }) => theme.space.x1};
    }
    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    small {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }
  `,
  Empty: styled.small`
    padding: ${({ theme }) => theme.space.x3};
    color: ${({ theme }) => theme.colors.text.muted};
  `,
  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};
  `,
};

export function ReferenceDocumentsDialog({
  open,
  documents,
  taskId,
  pending,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  documents: KnowledgeDocument[];
  taskId: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (documentIds: string[]) => void;
}) {
  const { titleId, descriptionId } = useDialogIds();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const sourceDocumentIds = useMemo(
    () =>
      new Set(
        documents.filter((document) => document.taskId === taskId).map((document) => document.id),
      ),
    [documents, taskId],
  );
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIds(
      documents
        .filter((document) => document.referenceTaskIds.includes(taskId))
        .map((document) => document.id),
    );
  }, [documents, open, taskId]);
  const visibleDocuments = documents.filter((document) =>
    `${document.title} ${document.fileName}`
      .toLocaleLowerCase("ko-KR")
      .includes(query.toLocaleLowerCase("ko-KR")),
  );

  return (
    <Styled.Dialog
      open={open}
      onOpenChange={onOpenChange}
      titleId={titleId}
      descriptionId={descriptionId}
    >
      <div>
        <h2 id={titleId}>참고 문서 관리</h2>
        <p id={descriptionId}>선택한 문서는 다음 실행에 함께 전달됩니다.</p>
      </div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="문서 검색"
      />
      <Styled.List>
        {visibleDocuments.map((document) => {
          const isSource = sourceDocumentIds.has(document.id);
          const checked = isSource || selectedIds.includes(document.id);
          return (
            <Styled.Row key={document.id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={isSource}
                onChange={() =>
                  setSelectedIds((current) =>
                    checked
                      ? current.filter((id) => id !== document.id)
                      : [...current, document.id],
                  )
                }
              />
              <span>
                <strong>{document.title}</strong>
                <small>{document.fileName}</small>
              </span>
              <small>{isSource ? "이 작업에서 생성" : checked ? "포함" : ""}</small>
            </Styled.Row>
          );
        })}
        {visibleDocuments.length === 0 && <Styled.Empty>표시할 문서가 없습니다.</Styled.Empty>}
      </Styled.List>
      <Styled.Actions>
        <Button $variant="secondary" onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <Button $variant="primary" disabled={pending} onClick={() => onSave(selectedIds)}>
          {pending ? "저장 중" : "선택 문서 저장"}
        </Button>
      </Styled.Actions>
    </Styled.Dialog>
  );
}
