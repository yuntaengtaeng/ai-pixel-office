import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ai-pixel-office/design-system";
import type { Agent, AgentRun, Workspace } from "@ai-pixel-office/domain/entities";
import { taskApi, type TaskDetail } from "../../api.ts";
import { recordApi } from "../../../records/api.ts";
import { skillApi } from "../../../skills/api.ts";
import { ExecutionContextPanel } from "../context/ExecutionContextPanel.tsx";
import { ReferenceDocumentsDialog } from "../context/ReferenceDocumentsDialog.tsx";
import { messageOf } from "../../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../../shared/ui/ErrorBanner.tsx";

/** 실행 환경(지침, 스킬, 참고 문서)과 기록을 문서로 만들기 */
export function RequestContextSection({
  task,
  agents,
  workspace,
  latestRun,
}: {
  task: TaskDetail;
  agents: Agent[];
  workspace: Workspace;
  latestRun?: AgentRun;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [referencesOpen, setReferencesOpen] = useState(false);
  const contexts = useQuery({
    queryKey: ["task-execution-context", task.id],
    queryFn: () => taskApi.executionContexts(task.id),
  });
  const skills = useQuery({ queryKey: ["skills", workspace.id], queryFn: () => skillApi.list() });
  const documents = useQuery({
    queryKey: ["knowledge-documents", workspace.id],
    queryFn: () => recordApi.list(workspace.id),
  });
  const refreshDocuments = () =>
    void queryClient.invalidateQueries({ queryKey: ["knowledge-documents", workspace.id] });
  const saveReferences = useMutation({
    mutationFn: async (selectedIds: string[]) => {
      const selected = new Set(selectedIds);
      await Promise.all(
        (documents.data ?? []).flatMap((document) => {
          if (document.taskId === task.id) return [];
          const referenced = document.referenceTaskIds.includes(task.id);
          if (referenced === selected.has(document.id)) return [];
          const referenceTaskIds = referenced
            ? document.referenceTaskIds.filter((taskId) => taskId !== task.id)
            : [...document.referenceTaskIds, task.id];
          return [recordApi.update(workspace.id, document.id, { referenceTaskIds })];
        }),
      );
    },
    onSuccess: () => {
      setReferencesOpen(false);
      refreshDocuments();
    },
  });
  const createRecord = useMutation({
    mutationFn: () => taskApi.createDocument(task.id),
    onSuccess: () => {
      refreshDocuments();
      navigate("/records");
    },
  });
  const referenceDocuments = (documents.data ?? []).filter(
    (document) => document.taskId === task.id || document.referenceTaskIds.includes(task.id),
  );
  const error = saveReferences.error ?? createRecord.error;

  return (
    <>
      <ExecutionContextPanel
        contexts={contexts.data ?? []}
        agents={agents}
        skills={skills.data ?? []}
        loading={contexts.isPending}
        error={contexts.isError ? messageOf(contexts.error) : undefined}
        referenceDocuments={referenceDocuments}
        usage={latestRun?.usage}
        onManageReferences={() => setReferencesOpen(true)}
      />
      <ReferenceDocumentsDialog
        open={referencesOpen}
        documents={documents.data ?? []}
        taskId={task.id}
        pending={saveReferences.isPending}
        onOpenChange={setReferencesOpen}
        onSave={(documentIds) => saveReferences.mutate(documentIds)}
      />
      {task.runs.length > 0 && (
        <Button
          $variant="secondary"
          $fullWidth
          disabled={createRecord.isPending}
          onClick={() => createRecord.mutate()}
        >
          {createRecord.isPending ? "기록을 문서로 정리하는 중…" : "AI로 문서 만들기"}
        </Button>
      )}
      {error && <ErrorBanner>{messageOf(error)}</ErrorBanner>}
    </>
  );
}
