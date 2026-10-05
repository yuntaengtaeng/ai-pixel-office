import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import styled from "styled-components";
import type { Task, Workspace } from "@ai-pixel-office/domain/entities";
import { recordApi } from "../../records/api.ts";
import { recordsOfProject } from "../../records/utils/recordGroups.ts";
import { relativeTime } from "../../../shared/lib/time.ts";
import { Empty } from "../../../shared/ui/Empty.tsx";

const List = styled.ul`
  max-width: 760px;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  border-radius: ${({ theme }) => theme.radius.lg};
  li + li {
    border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
  }
  a {
    display: grid;
    gap: 2px;
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x4}`};
    color: ${({ theme }) => theme.colors.text.primary};
    text-decoration: none;
  }
  a:hover {
    background: ${({ theme }) => theme.colors.background.surface};
  }
  small {
    color: ${({ theme }) => theme.colors.text.muted};
  }
`;

/** 이 프로젝트의 기안서에서 만든 기록과 참고 문서 */
export function ProjectRecords({
  workspace,
  projectId,
  tasks,
}: {
  workspace: Workspace;
  projectId: string;
  tasks: Task[];
}) {
  const documents = useQuery({
    queryKey: ["knowledge-documents", workspace.id],
    queryFn: () => recordApi.list(workspace.id),
  });
  const taskTitle = new Map(tasks.map((task) => [task.id, task.title]));
  const projectDocuments = recordsOfProject(documents.data ?? [], tasks, projectId);
  if (documents.isPending) return <small>불러오는 중…</small>;
  if (projectDocuments.length === 0)
    return <Empty>기안서 화면에서 "AI로 문서 만들기"를 누르면 여기에 모여요.</Empty>;
  return (
    <List>
      {projectDocuments.map((document) => (
        <li key={document.id}>
          <Link to={`/records?document=${document.id}`}>
            <strong>{document.title}</strong>
            <small>
              {document.taskId ? taskTitle.get(document.taskId) : "참고 문서"} ·{" "}
              {relativeTime(document.updatedAt)}
            </small>
          </Link>
        </li>
      ))}
    </List>
  );
}
