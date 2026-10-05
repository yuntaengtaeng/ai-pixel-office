import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { agentApi } from "../agents/api.ts";
import { taskApi } from "../tasks/api.ts";
import { RequestBoard } from "../tasks/components/board/RequestBoard.tsx";
import { RequestInspector } from "../tasks/components/board/RequestInspector.tsx";
import { projectApi } from "./api.ts";
import { ProjectRecords } from "./components/ProjectRecords.tsx";
import { LeadWorkspace } from "../lead/components/LeadWorkspace.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ProjectSettingsForm } from "./components/settings/ProjectSettingsForm.tsx";
import { ProjectDangerZone } from "./components/settings/ProjectDangerZone.tsx";
import { messageOf } from "../../shared/lib/errors.ts";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { FullScreenMessage } from "../../shared/ui/FullScreenMessage.tsx";
import { PathChip } from "../../shared/ui/PathChip.tsx";
import { Tabs } from "../../shared/ui/Tabs.tsx";

const PROJECT_TABS = ["lead", "requests", "records", "settings"] as const;
type ProjectTab = (typeof PROJECT_TABS)[number];

function projectTabOf(value: string | null): ProjectTab {
  return PROJECT_TABS.find((tab) => tab === value) ?? "lead";
}

const Styled = {
  Header: styled.header`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};
    h1 {
      margin: 0;
      font-size: ${({ theme }) => theme.typography.fontSize.headingLg};
    }
  `,
  Actions: styled.div`
    margin-left: auto;
    display: flex;
    gap: ${({ theme }) => theme.space.x2};
  `,
  Description: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.secondary};
  `,
  Body: styled.div<{ $withInspector: boolean }>`
    display: grid;
    grid-template-columns: ${({ $withInspector }) => ($withInspector ? "minmax(0, 1fr) 360px" : "minmax(0, 1fr)")};
    gap: ${({ theme }) => theme.space.x4};
    align-items: start;
    @media ${({ theme }) => theme.mediaQuery.lg} {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  Content: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x6};
    padding-top: ${({ theme }) => theme.space.x4};
  `,
};

/** 프로젝트 화면 (작업 폴더, 이 프로젝트에 요청, 기안서 보드·기록·설정) */
export function ProjectWorkspacePage({ workspace }: { workspace: Workspace }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = projectTabOf(searchParams.get("tab"));
  const showTab = (next: ProjectTab) => setSearchParams(next === "lead" ? {} : { tab: next });
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const project = useQuery({ queryKey: ["project", id], queryFn: () => projectApi.get(id) });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const refreshProjectList = () =>
    void queryClient.invalidateQueries({ queryKey: ["projects", workspace.id] });
  const refreshProject = () => {
    void queryClient.invalidateQueries({ queryKey: ["project", id] });
    refreshProjectList();
  };

  if (project.isPending) return <FullScreenMessage>프로젝트를 불러오는 중...</FullScreenMessage>;
  if (project.isError || !project.data)
    return <FullScreenMessage error>{messageOf(project.error)}</FullScreenMessage>;
  const requests = (tasks.data ?? []).filter((task) => task.projectId === id);

  return (
    <BaseLayout>
      <Styled.Header>
        <h1>{project.data.name}</h1>
        <PathChip
          path={project.data.path ?? "작업 폴더를 연결해 주세요"}
          title="이 프로젝트의 요청은 이 폴더에서 작업해요"
        />
        <Styled.Actions>
          {project.data.previewUrl && (
            <Button
              as="a"
              href={project.data.previewUrl}
              target="_blank"
              rel="noreferrer"
              $variant="secondary"
            >
              화면 미리보기
            </Button>
          )}
          {project.data.path ? (
            <Button $variant="primary" onClick={() => navigate(`/new?project=${id}`)}>
              + 동료 한 명에게 요청
            </Button>
          ) : (
            <Button $variant="primary" onClick={() => showTab("settings")}>
              작업 폴더 연결
            </Button>
          )}
        </Styled.Actions>
      </Styled.Header>
      {project.data.description && (
        <Styled.Description>{project.data.description}</Styled.Description>
      )}
      <Tabs
        label="프로젝트 화면"
        value={tab}
        onChange={showTab}
        items={[
          { value: "lead", label: "팀장" },
          { value: "requests", label: "기안서", count: requests.length },
          { value: "records", label: "기록" },
          { value: "settings", label: "설정" },
        ]}
      />
      <Styled.Content>
        {tab === "lead" &&
          (project.data.path ? (
            <LeadWorkspace project={project.data} agents={agents.data ?? []} tasks={requests} />
          ) : (
            <Empty>작업 폴더를 연결하면 이 프로젝트의 팀장이 생겨요.</Empty>
          ))}
        {tab === "requests" && (
          <Styled.Body $withInspector={Boolean(selectedTaskId)}>
            <RequestBoard
              tasks={requests}
              agents={agents.data ?? []}
              selectedId={selectedTaskId}
              onSelect={setSelectedTaskId}
            />
            {selectedTaskId && (
              <RequestInspector
                taskId={selectedTaskId}
                workspace={workspace}
                onClose={() => setSelectedTaskId(undefined)}
              />
            )}
          </Styled.Body>
        )}
        {tab === "records" && (
          <ProjectRecords workspace={workspace} projectId={id} tasks={requests} />
        )}
        {tab === "settings" && agents.data && (
          <>
            <ProjectSettingsForm
              key={project.data.updatedAt}
              project={project.data}
              agents={agents.data}
              onSaved={refreshProject}
            />
            <ProjectDangerZone
              project={project.data}
              requestCount={requests.length}
              onRemoved={refreshProjectList}
            />
          </>
        )}
      </Styled.Content>
    </BaseLayout>
  );
}
