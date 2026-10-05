import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import styled from "styled-components";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { agentApi } from "../agents/api.ts";
import { projectApi } from "../projects/api.ts";
import { taskApi } from "./api.ts";
import { RequestComposer, type RequestDraft } from "./components/compose/RequestComposer.tsx";
import { assignableAgents } from "./utils/requestAssignee.ts";
import { rememberProject, recentProjectId } from "../../shared/lib/recentProject.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { PageLoading } from "../../shared/ui/PageLoading.tsx";

const Styled = {
  Home: styled.div`
    width: min(760px, 100%);
    margin: 0 auto;
    padding-top: ${({ theme }) => theme.space.x18};
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
    h1 {
      margin: 0;
      text-align: center;
      font-family: ${({ theme }) => theme.typography.fontFamily.serif};
      font-size: ${({ theme }) => theme.typography.fontSize.displayXs};
    }
  `,
  Hint: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
};

/** 새 요청 화면 (Claude·Codex 앱처럼 입력창에서 시작, 폴더를 고르면 그 프로젝트의 기안서가 됨) */
export function NewRequestPage({ workspace }: { workspace: Workspace }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const lockedProjectId = searchParams.get("project") ?? undefined;
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const projects = useQuery({
    queryKey: ["projects", workspace.id],
    queryFn: () => projectApi.list(workspace.id),
  });
  const start = useMutation({
    mutationFn: (draft: RequestDraft) =>
      taskApi.startRequest({
        workspaceId: workspace.id,
        message: draft.message,
        agentId: draft.assignee.id,
        ...(draft.projectId ? { projectId: draft.projectId } : {}),
        files: draft.files,
      }),
    onSuccess: (task) => {
      rememberProject(workspace.id, task.projectId);
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/tasks/${task.id}`);
    },
  });

  if (agents.isPending || projects.isPending) return <PageLoading />;
  const assignees = assignableAgents(agents.data ?? []);
  const folderProjects = (projects.data ?? []).filter((project) => project.path);
  const lockedProject = folderProjects.find((project) => project.id === lockedProjectId);
  const initialProjectId =
    lockedProject?.id ??
    folderProjects.find((project) => project.id === recentProjectId(workspace.id))?.id ??
    "";

  return (
    <BaseLayout>
      <Styled.Home>
        <h1>무엇을 맡길까요?</h1>
        {assignees.length === 0 ? (
          <Empty>먼저 조직도에서 동료를 만들거나 팀을 들여오세요.</Empty>
        ) : (
          <RequestComposer
            agents={assignees}
            projects={folderProjects}
            initialProjectId={initialProjectId}
            projectLocked={Boolean(lockedProject)}
            pending={start.isPending}
            onSubmit={(draft) => start.mutateAsync(draft)}
          />
        )}
        <Styled.Hint>
          {lockedProject
            ? `${lockedProject.name} 폴더에서 작업하는 기안서로 시작해요.`
            : "폴더를 고르지 않으면 파일을 고치지 않는 대화로 시작해요. 폴더를 고르면 그 프로젝트의 기안서가 돼요."}
        </Styled.Hint>
        {start.isError && <ErrorBanner>{messageOf(start.error)}</ErrorBanner>}
      </Styled.Home>
    </BaseLayout>
  );
}
