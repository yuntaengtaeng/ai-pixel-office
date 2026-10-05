import { useState } from "react";
import styled from "styled-components";
import { Button, Select } from "@ai-pixel-office/design-system";
import type { Agent, Project } from "@ai-pixel-office/domain/entities";
import {
  ComposerAttachments,
  ComposerForm,
  ComposerTextArea,
} from "../../../../shared/ui/composer/Composer.tsx";
import { useAttachmentDraft } from "../../../../shared/hooks/useAttachmentDraft.ts";
import { pickAssignee } from "../../utils/requestAssignee.ts";

export type RequestDraft = {
  message: string;
  assignee: Agent;
  /** 비어 있으면 프로젝트 없이 대화 */
  projectId: string;
  files: File[];
};

const Card = styled.form`
  width: 100%;
  display: grid;
  gap: ${({ theme }) => theme.space.x3};
  padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x4}`};
  border: 1px solid ${({ theme }) => theme.colors.border.strong};
  border-radius: ${({ theme }) => theme.radius.xl};
  background: ${({ theme }) => theme.colors.background.surface};
  &:focus-within {
    border-color: ${({ theme }) => theme.colors.brand.primary};
  }
  textarea {
    min-height: 72px;
    border: 0;
    background: transparent;
    padding: 0;
    resize: none;
    box-shadow: none;
  }
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space.x2};
  select {
    width: auto;
    min-height: 32px;
    border-radius: ${({ theme }) => theme.radius.pill};
  }
  > :last-child {
    margin-left: auto;
  }
`;

/** 새 요청 입력창 (요청문, 받는 동료, 작업 폴더, 첨부) */
export function RequestComposer({
  agents,
  projects,
  initialProjectId,
  projectLocked,
  pending,
  onSubmit,
}: {
  /** 맡길 수 있는 동료 */
  agents: Agent[];
  /** 폴더가 연결된 프로젝트 */
  projects: Project[];
  initialProjectId?: string;
  /** 프로젝트 화면에서 시작해 폴더가 정해져 있음 */
  projectLocked?: boolean;
  pending: boolean;
  onSubmit: (draft: RequestDraft) => Promise<unknown>;
}) {
  const [message, setMessage] = useState("");
  const [chosenAssigneeId, setChosenAssigneeId] = useState<string>();
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const attachments = useAttachmentDraft();
  const project = projects.find((candidate) => candidate.id === projectId);
  const assignee = pickAssignee(agents, chosenAssigneeId, project?.defaultAgentId);
  const canSubmit = Boolean(message.trim() && assignee && !pending);

  const submit = async () => {
    if (!canSubmit || !assignee) return;
    await onSubmit({ message: message.trim(), assignee, projectId, files: attachments.files });
    setMessage("");
    attachments.clear();
  };

  return (
    <ComposerForm component={Card} attachments={attachments} pending={pending} onSubmit={submit}>
      <ComposerTextArea
        attachments={attachments}
        onSubmit={submit}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="예) 로그인 화면 실패 문구를 친절하게 바꿔줘"
        aria-label="요청 내용"
        autoFocus
      />
      <ComposerAttachments attachments={attachments} />
      <Row>
        <Select
          aria-label="맡길 동료"
          value={assignee?.id ?? ""}
          onChange={(event) => setChosenAssigneeId(event.target.value)}
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} · {agent.role}
            </option>
          ))}
        </Select>
        <Select
          aria-label="작업 폴더"
          value={projectId}
          disabled={projectLocked}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">폴더 없음 (프로젝트 없이 대화)</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Button $variant="primary" type="submit" disabled={!canSubmit}>
          {pending ? "맡기는 중" : "맡기기"}
        </Button>
      </Row>
    </ComposerForm>
  );
}
