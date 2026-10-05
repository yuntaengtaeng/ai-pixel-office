import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Input, Panel, mediaQuery } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { projectApi } from "../projects/api.ts";
import { taskApi } from "../tasks/api.ts";
import { recordApi } from "./api.ts";
import { RecordEditor } from "./components/RecordEditor.tsx";
import { RecordList } from "./components/RecordList.tsx";
import { useSelectedDocumentId } from "./hooks/useSelectedDocumentId.ts";
import { groupRecordsByProject, searchRecords } from "./utils/recordGroups.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";

const Styled = {
  Hint: styled.p`
    margin: 0 0 ${({ theme }) => theme.space.x4};
    color: ${({ theme }) => theme.colors.text.muted};
  `,
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
    align-items: start;
    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  ListPanel: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x3};
  `,
};

/** 기록 (프로젝트별로 묶은 문서 목록과 읽기·편집 화면) */
export function RecordsPage({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const records = useQuery({
    queryKey: ["knowledge-documents", workspace.id],
    queryFn: () => recordApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const projects = useQuery({
    queryKey: ["projects", workspace.id],
    queryFn: () => projectApi.list(workspace.id),
  });
  const { selectedId, select } = useSelectedDocumentId(records.data);
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["knowledge-documents", workspace.id] });
  const importRecord = useMutation({
    mutationFn: async (file: File) => recordApi.import(workspace.id, file.name, await file.text()),
    onSuccess: (document) => {
      select(document.id);
      refresh();
    },
  });
  const selected = records.data?.find((document) => document.id === selectedId);
  const groups = groupRecordsByProject(
    searchRecords(records.data ?? [], query),
    tasks.data ?? [],
    projects.data ?? [],
  );
  const error = records.error ?? importRecord.error;

  return (
    <BaseLayout>
      <PageHeader
        eyebrow="OFFICE ARCHIVE"
        title="기록"
        action={
          <Button $variant="primary" onClick={() => select(undefined)}>
            + 새 문서
          </Button>
        }
      />
      <Styled.Hint>
        기안서에서 얻은 결정과 결과를 Markdown으로 남기고 다시 찾아보세요. 파일은 내 컴퓨터에
        저장돼요.
      </Styled.Hint>
      <Styled.Toolbar>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="문서 검색"
          aria-label="문서 검색"
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
        <Styled.ListPanel>
          {groups.length > 0 ? (
            <RecordList groups={groups} selectedId={selectedId} onSelect={select} />
          ) : (
            !records.isPending &&
            (query ? (
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
            ) : (
              <Empty title="아직 문서가 없어요">
                기안서 화면에서 "AI로 문서 만들기"를 누르거나 새 문서를 써 보세요.
              </Empty>
            ))
          )}
        </Styled.ListPanel>
        <RecordEditor
          key={selected?.id ?? "new"}
          workspaceId={workspace.id}
          document={selected}
          sourceTask={tasks.data?.find((task) => task.id === selected?.taskId)}
          onSaved={(documentId) => {
            select(documentId);
            refresh();
          }}
          onRemoved={() => {
            select(undefined);
            refresh();
          }}
        />
      </Styled.Grid>
    </BaseLayout>
  );
}
