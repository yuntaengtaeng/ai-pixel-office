import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Select } from "@ai-pixel-office/design-system";
import type { Agent, Workspace } from "@ai-pixel-office/domain/entities";
import { taskApi, type TaskDetail } from "../../api.ts";
import { ProjectSelect } from "../../../projects/ProjectSelect.tsx";
import { TaskTodoView } from "./TaskTodoView.tsx";
import { messageOf } from "../../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../../shared/ui/ErrorBanner.tsx";

const Styled = {
  Panel: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  Assignment: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    span {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
  `,
};

/** 아직 시작하지 않은 기안서의 준비 (요청문, 담당, 작업 폴더, 시작) */
export function RequestSetupPanel({
  task,
  agents,
  workspace,
  onChanged,
}: {
  task: TaskDetail;
  agents: Agent[];
  workspace: Workspace;
  onChanged: () => void;
}) {
  const [brief, setBrief] = useState(task.description ?? "");
  const saveBrief = useMutation({
    mutationFn: () => taskApi.update(task.id, { description: brief.trim() }),
    onSuccess: onChanged,
  });
  const start = useMutation({
    mutationFn: async () => {
      if (brief.trim() !== (task.description ?? "").trim())
        await taskApi.update(task.id, { description: brief.trim() });
      return taskApi.run(task.id);
    },
    onSuccess: onChanged,
  });
  const assign = useMutation({
    mutationFn: (assigneeAgentId: string) => taskApi.update(task.id, { assigneeAgentId }),
    onSuccess: onChanged,
  });
  const moveProject = useMutation({
    mutationFn: (projectId: string) => taskApi.update(task.id, { projectId }),
    onSuccess: onChanged,
  });
  const assigned = Boolean(task.assigneeAgentId);
  const error = start.error ?? saveBrief.error ?? assign.error ?? moveProject.error;

  return (
    <Styled.Panel>
      <TaskTodoView
        value={brief}
        originalValue={task.description ?? ""}
        savePending={saveBrief.isPending}
        onChange={setBrief}
        onSave={() => saveBrief.mutate()}
      />
      <Styled.Assignment>
        <span>
          {assigned ? "시작하기 전까지 담당을 바꿀 수 있어요." : "먼저 담당 동료를 정해 주세요."}
        </span>
        {agents.length > 0 ? (
          <Select
            aria-label="담당 동료"
            value={task.assigneeAgentId ?? ""}
            disabled={assign.isPending}
            onChange={(event) => assign.mutate(event.target.value)}
          >
            <option value="">아직 정하지 않음</option>
            {agents.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                {candidate.name} · {candidate.model.toUpperCase()}
              </option>
            ))}
          </Select>
        ) : (
          <Button as={Link} to="/agents" $variant="secondary">
            첫 동료 만들기
          </Button>
        )}
      </Styled.Assignment>
      <ProjectSelect
        workspaceId={workspace.id}
        value={task.projectId ?? ""}
        onChange={(value) => moveProject.mutate(value)}
      />
      <Button
        $variant="primary"
        $fullWidth
        disabled={!assigned || start.isPending}
        onClick={() => start.mutate()}
      >
        {start.isPending ? "시작하는 중" : "기안서 시작"}
      </Button>
      {error && <ErrorBanner>{messageOf(error)}</ErrorBanner>}
    </Styled.Panel>
  );
}
