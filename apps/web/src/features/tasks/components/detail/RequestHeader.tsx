import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { BackButton } from "@ai-pixel-office/design-system";
import type { Agent, Project } from "@ai-pixel-office/domain/entities";
import type { TaskDetail } from "../../api.ts";
import { approvalLineCells } from "../../utils/approvalLine.ts";
import { ApprovalLine } from "../approval/ApprovalLine.tsx";
import { TaskStatusPill } from "../TaskStatusPill.tsx";
import { PathChip } from "../../../../shared/ui/PathChip.tsx";

const Styled = {
  Header: styled.header`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x4};
  `,
  Title: styled.div`
    min-width: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    h1 {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${({ theme }) => theme.space.x3};
      font-family: ${({ theme }) => theme.typography.fontFamily.serif};
      font-size: ${({ theme }) => theme.typography.fontSize.headingLg};
    }
  `,
};

/** 기안서 머리말 (돌아가기, 제목, 상태, 작업 폴더, 결재란) */
export function RequestHeader({
  task,
  project,
  agents,
}: {
  task: TaskDetail;
  project?: Project;
  agents: Agent[];
}) {
  const navigate = useNavigate();
  return (
    <>
      <BackButton onClick={() => navigate(project ? `/projects/${project.id}` : "/")}>
        ← {project ? project.name : "오피스"}
      </BackButton>
      <Styled.Header>
        <Styled.Title>
          <h1>
            {task.title}
            <TaskStatusPill task={task} />
          </h1>
          <PathChip
            path={project ? `${project.name} · ${project.path ?? ""}` : "프로젝트 없이 대화"}
            title={project ? "이 기안서는 이 폴더에서 작업해요" : undefined}
          />
        </Styled.Title>
        <ApprovalLine cells={approvalLineCells(task, agents)} />
      </Styled.Header>
    </>
  );
}
