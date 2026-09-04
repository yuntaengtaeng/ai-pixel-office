import { colors, mediaQuery } from "@ai-pixel-office/design-system";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import {
  BackButton,
  Button,
  Field,
  Input,
  Kicker,
  Panel,
  panelStyles,
  Select,
  TextArea,
} from "@ai-pixel-office/design-system";
import type { Project, Workspace } from "@ai-pixel-office/domain/entities";
import { agentApi } from "../agents/api.ts";
import { taskApi } from "../tasks/api.ts";
import { projectApi } from "./api.ts";
import { projectStatusLabel } from "./presentation.ts";
import { PetPreview } from "../office/PetPreview.tsx";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { FullScreenMessage } from "../../shared/ui/FullScreenMessage.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { PromptSuggestions } from "../../shared/ui/PromptSuggestions.tsx";
import { SectionHeading } from "../../shared/ui/SectionHeading.tsx";
import { TechnicalDetails } from "../../shared/ui/TechnicalDetails.tsx";
import { TaskCard } from "../tasks/TaskCard.tsx";

const STATUS_COLORS: Record<
  Project["status"],
  { border: string; background: string; color: string }
> = {
  active: { ...colors.projectStatus.active, color: colors.projectStatus.active.foreground },
  paused: { ...colors.projectStatus.paused, color: colors.projectStatus.paused.foreground },
  done: { ...colors.projectStatus.done, color: colors.projectStatus.done.foreground },
};

const Styled = {
  Layout: styled.div`
    display: grid;
    grid-template-columns: minmax(280px, 0.7fr) minmax(0, 1.3fr);
    gap: ${({ theme }) => theme.space.x5};
    align-items: start;

    @media ${mediaQuery.xl} {
      grid-template-columns: 1fr;
    }
  `,
  CreateForm: styled(Panel).attrs({ as: "form" })`
    padding: ${({ theme }) => theme.space.x5};
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
    position: sticky;
    top: 24px;

    h2 {
      margin: ${({ theme }) => `${theme.space.x1} 0 ${theme.space.x2}`};
      font-size: ${({ theme }) => theme.typography.fontSize.headingMd};
    }

    > div:first-child p {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      line-height: 1.6;
    }

    @media ${mediaQuery.xl} {
      position: static;
    }
  `,
  Board: styled.section`
    > ${SectionHeading} {
      margin-bottom: ${({ theme }) => theme.space.x3};
    }
  `,
  CardGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.space.x3};

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  Card: styled(Link)`
    ${panelStyles}
    min-width: 0;
    min-height: 190px;
    padding: ${({ theme }) => theme.space.x4};
    display: flex;
    flex-direction: column;
    color: inherit;

    &:hover {
      border-color: ${({ theme }) => theme.colors.border.positive};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      box-shadow: 4px 4px 0 ${({ theme }) => theme.colors.border.positive};
      transform: translate(-1px, -1px);
    }

    > div:first-child {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${({ theme }) => theme.space.x2};
    }

    h3 {
      margin: ${({ theme }) => `${theme.space.x3} 0 ${theme.space.x2}`};
      font-size: ${({ theme }) => theme.typography.fontSize.subtitle};
    }

    p {
      margin: ${({ theme }) => `0 0 ${theme.space.x4}`};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      line-height: 1.55;
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }

    footer {
      margin-top: auto;
      padding-top: ${({ theme }) => theme.space.x3};
      border-top: 1px dashed ${({ theme }) => theme.colors.border.subtle};
      display: flex;
      align-items: center;
      gap: ${({ theme }) => theme.space.x3};
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};

      strong {
        margin-left: auto;
        color: ${({ theme }) => theme.colors.text.positive};
      }
    }
  `,
  StatusBadge: styled.span<{ $status: Project["status"] }>`
    width: fit-content;
    padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
    border: 1px solid ${({ $status }) => STATUS_COLORS[$status].border};
    background: ${({ $status }) => STATUS_COLORS[$status].background};
    color: ${({ $status }) => STATUS_COLORS[$status].color};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  `,
  FigmaBadge: styled.span`
    color: ${({ theme }) => theme.colors.text.secondary};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
  `,
  DetailHeading: styled.div`
    margin: ${({ theme }) => `${theme.space.x6} 0`};
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x5};

    h1 {
      margin: ${({ theme }) => `${theme.space.x3} 0 ${theme.space.x2}`};
      font-size: ${({ theme }) => theme.typography.fontSize.displayMd};
    }

    p {
      max-width: 720px;
      margin: 0;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      line-height: 1.6;
    }
  `,
  DetailLayout: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.55fr);
    gap: ${({ theme }) => theme.space.x5};
    align-items: start;

    @media ${mediaQuery.xl} {
      grid-template-columns: 1fr;
    }
  `,
  MainColumn: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x5};
  `,
  TaskCreateForm: styled(Panel).attrs({ as: "form" })`
    padding: ${({ theme }) => theme.space.x5};
    display: grid;
    grid-template-columns: minmax(0, 0.75fr) minmax(0, 1fr) auto;
    align-items: end;
    gap: ${({ theme }) => theme.space.x3};

    > ${SectionHeading} {
      grid-column: 1 / -1;
    }

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  TasksSection: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x5};
  `,
  TaskList: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
  `,
  ContextForm: styled(Panel).attrs({ as: "form" })`
    padding: ${({ theme }) => theme.space.x5};
    display: grid;
    gap: ${({ theme }) => theme.space.x3};

    h2 {
      margin: ${({ theme }) => `0 0 ${theme.space.x1}`};
      font-size: ${({ theme }) => theme.typography.fontSize.lead};
    }
  `,
  FigmaLink: styled(Button).attrs({ $variant: "secondary" })`
    text-align: center;
  `,
  Members: styled.div`
    padding-top: ${({ theme }) => theme.space.x3};
    border-top: 1px dashed ${({ theme }) => theme.colors.border.subtle};
    display: grid;
    gap: ${({ theme }) => theme.space.x2};

    > strong {
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }

    > div {
      display: flex;
      flex-wrap: wrap;
      gap: ${({ theme }) => theme.space.x2};
    }

    a {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2} ${theme.space.x1} ${theme.space.x1}`};
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      display: flex;
      align-items: center;
      gap: ${({ theme }) => theme.space.x1};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }

    small {
      margin: 0;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
  `,
  PathNote: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    line-height: 1.5;
    overflow-wrap: anywhere;
  `,
};

export function ProjectsPage({ workspace }: { workspace: Workspace }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projects = useQuery({
    queryKey: ["projects", workspace.id],
    queryFn: () => projectApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const create = useMutation({
    mutationFn: () =>
      projectApi.create({
        workspaceId: workspace.id,
        name,
        description: description.trim() || undefined,
        figmaUrl: figmaUrl.trim() || undefined,
      }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ["projects", workspace.id] });
      navigate(`/projects/${project.id}`);
    },
  });
  const projectTasks = tasks.data ?? [];
  return (
    <BaseLayout>
      <PageHeader eyebrow="PROJECT ROOM" title="프로젝트" />
      <Styled.Layout>
        <Styled.CreateForm
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <Kicker>NEW PROJECT</Kicker>
            <h2>새 프로젝트 시작하기</h2>
            <p>목표와 작업을 한곳에 모아 팀이 같은 맥락에서 일하게 합니다.</p>
          </div>
          <Field>
            <label>프로젝트 이름</label>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 모바일 앱 리뉴얼"
              required
            />
          </Field>
          <Field>
            <label>이 프로젝트에서 이루고 싶은 것 · 선택 사항</label>
            <TextArea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="예: 신규 사용자가 첫 주문까지 막힘없이 도달하도록 주요 화면을 개선해요"
            />
            <small>정확하지 않아도 괜찮습니다. 나중에 언제든 바꿀 수 있어요.</small>
          </Field>
          <PromptSuggestions>
            {[
              "화면 사용성을 검토하고 개선안을 만들어요",
              "반복 업무를 자동화해 팀의 시간을 줄여요",
              "아이디어를 검증할 프로토타입을 만들어요",
            ].map((example) => (
              <button type="button" key={example} onClick={() => setDescription(example)}>
                {example}
              </button>
            ))}
          </PromptSuggestions>
          <TechnicalDetails>
            <summary>디자인 연결 · 선택 사항</summary>
            <Field>
              <label>Figma 링크</label>
              <Input
                value={figmaUrl}
                onChange={(event) => setFigmaUrl(event.target.value)}
                placeholder="https://figma.com/design/..."
              />
            </Field>
          </TechnicalDetails>
          <Button $variant="primary" $fullWidth disabled={!name.trim() || create.isPending}>
            {create.isPending ? "만드는 중..." : "프로젝트 만들기"}
          </Button>
          {create.isError && <ErrorBanner>{messageOf(create.error)}</ErrorBanner>}
        </Styled.CreateForm>
        <Styled.Board>
          <SectionHeading $compact>
            <h2>진행 중인 프로젝트</h2>
            <span>{projects.data?.length ?? 0}</span>
          </SectionHeading>
          <Styled.CardGrid>
            {(projects.data ?? []).map((project) => {
              const related = projectTasks.filter((task) => task.projectId === project.id);
              const completed = related.filter((task) => task.status === "done").length;
              return (
                <Styled.Card to={`/projects/${project.id}`} key={project.id}>
                  <div>
                    <Styled.StatusBadge $status={project.status}>
                      {projectStatusLabel(project.status)}
                    </Styled.StatusBadge>
                    {project.figmaUrl && <Styled.FigmaBadge>FIGMA</Styled.FigmaBadge>}
                  </div>
                  <h3>{project.name}</h3>
                  <p>
                    {project.description ||
                      "목표를 추가하면 에이전트가 프로젝트 맥락을 이해하기 쉬워져요."}
                  </p>
                  <footer>
                    <span>작업 {related.length}</span>
                    <span>완료 {completed}</span>
                    <strong>열기 →</strong>
                  </footer>
                </Styled.Card>
              );
            })}
            {!projects.isPending && projects.data?.length === 0 && (
              <Panel>
                <Empty>첫 프로젝트를 만들어 보세요.</Empty>
              </Panel>
            )}
          </Styled.CardGrid>
          {projects.isError && <ErrorBanner>{messageOf(projects.error)}</ErrorBanner>}
        </Styled.Board>
      </Styled.Layout>
    </BaseLayout>
  );
}

export function ProjectDetailPage({ workspace }: { workspace: Workspace }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();
  const projectQuery = useQuery({ queryKey: ["project", id], queryFn: () => projectApi.get(id) });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Project["status"]>("active");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [title, setTitle] = useState("");
  const [result, setResult] = useState("");
  useEffect(() => {
    const project = projectQuery.data;
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setStatus(project.status);
    setFigmaUrl(project.figmaUrl ?? "");
  }, [projectQuery.data]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["project", id] });
    void queryClient.invalidateQueries({ queryKey: ["projects", workspace.id] });
  };
  const save = useMutation({
    mutationFn: () =>
      projectApi.update(id, {
        name,
        description: description.trim() || undefined,
        status,
        figmaUrl: figmaUrl.trim() || undefined,
      }),
    onSuccess: refresh,
  });
  const createTask = useMutation({
    mutationFn: () =>
      taskApi.create({
        workspaceId: workspace.id,
        projectId: id,
        title,
        description: result.trim() || undefined,
        priority: "medium",
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/tasks/${created.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => projectApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects", workspace.id] });
      navigate("/projects");
    },
  });
  if (projectQuery.isPending)
    return <FullScreenMessage>프로젝트를 불러오는 중...</FullScreenMessage>;
  if (projectQuery.isError || !projectQuery.data)
    return <FullScreenMessage error>{messageOf(projectQuery.error)}</FullScreenMessage>;
  const relatedTasks = (tasks.data ?? []).filter((task) => task.projectId === id);
  const memberIds = new Set(relatedTasks.map((task) => task.assigneeAgentId).filter(Boolean));
  const members = (agents.data ?? []).filter((agent) => memberIds.has(agent.id));
  return (
    <BaseLayout>
      <BackButton onClick={() => navigate("/projects")}>← 프로젝트 목록</BackButton>
      <Styled.DetailHeading>
        <div>
          <Styled.StatusBadge $status={status}>{projectStatusLabel(status)}</Styled.StatusBadge>
          <h1>{projectQuery.data.name}</h1>
          <p>{projectQuery.data.description || "아직 프로젝트 목표가 없습니다."}</p>
        </div>
        <Button
          type="submit"
          form="project-context-form"
          $variant="secondary"
          disabled={save.isPending || !name.trim()}
        >
          변경 저장
        </Button>
      </Styled.DetailHeading>
      <Styled.DetailLayout>
        <Styled.MainColumn>
          <Styled.TaskCreateForm
            onSubmit={(event) => {
              event.preventDefault();
              createTask.mutate();
            }}
          >
            <SectionHeading $compact>
              <h2>새 작업</h2>
              <span>담당자는 다음 화면에서 선택</span>
            </SectionHeading>
            <Field>
              <label>무엇을 맡길까요?</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예: 결제 화면 사용성 검토"
                required
              />
            </Field>
            <Field>
              <label>원하는 결과 · 선택 사항</label>
              <Input
                value={result}
                onChange={(event) => setResult(event.target.value)}
                placeholder="예: 문제와 개선안을 우선순위로 정리해 주세요"
              />
            </Field>
            <Button $variant="primary" disabled={!title.trim() || createTask.isPending}>
              작업 만들기
            </Button>
            {createTask.isError && <ErrorBanner>{messageOf(createTask.error)}</ErrorBanner>}
          </Styled.TaskCreateForm>
          <Styled.TasksSection>
            <SectionHeading $compact>
              <h2>프로젝트 작업</h2>
              <span>{relatedTasks.length}</span>
            </SectionHeading>
            <Styled.TaskList>
              {relatedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  agent={(agents.data ?? []).find((agent) => agent.id === task.assigneeAgentId)}
                />
              ))}
              {relatedTasks.length === 0 && <Empty>첫 작업을 만들어 프로젝트를 시작하세요.</Empty>}
            </Styled.TaskList>
          </Styled.TasksSection>
        </Styled.MainColumn>
        <Styled.ContextForm
          id="project-context-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() && !save.isPending) save.mutate();
          }}
        >
          <h2>프로젝트 맥락</h2>
          <Field>
            <label>이름</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field>
            <label>목표</label>
            <TextArea
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field>
            <label>상태</label>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as Project["status"])}
            >
              <option value="active">진행 중</option>
              <option value="paused">잠시 멈춤</option>
              <option value="done">완료</option>
            </Select>
          </Field>
          <Field>
            <label>Figma 링크</label>
            <Input
              value={figmaUrl}
              onChange={(event) => setFigmaUrl(event.target.value)}
              placeholder="선택 사항"
            />
          </Field>
          {figmaUrl && (
            <Styled.FigmaLink as="a" href={figmaUrl} target="_blank" rel="noreferrer">
              Figma에서 열기 ↗
            </Styled.FigmaLink>
          )}
          <Styled.Members>
            <strong>참여한 에이전트</strong>
            <div>
              {members.map((member) => (
                <Link to={`/agents/${member.id}`} key={member.id}>
                  <PetPreview petId={member.avatarId ?? ""} size={34} />
                  <span>{member.name}</span>
                </Link>
              ))}
              {members.length === 0 && <small>작업에 에이전트를 배치하면 여기에 표시됩니다.</small>}
            </div>
          </Styled.Members>
          <TechnicalDetails>
            <summary>개발자 옵션</summary>
            <Styled.PathNote>
              {projectQuery.data.path || "연결된 로컬 폴더가 없습니다. 설정에서 연결할 수 있어요."}
            </Styled.PathNote>
          </TechnicalDetails>
          <Button
            type="button"
            $variant="danger"
            $fullWidth
            disabled={remove.isPending}
            onClick={async () => {
              if (
                await confirm({
                  title: `${projectQuery.data.name} 프로젝트를 삭제할까요?`,
                  description: "작업은 삭제되지 않고 프로젝트 연결만 해제됩니다.",
                  confirmLabel: "프로젝트 삭제",
                  tone: "danger",
                })
              )
                remove.mutate();
            }}
          >
            프로젝트 삭제
          </Button>
          {(save.isError || remove.isError) && (
            <ErrorBanner>{messageOf(save.error ?? remove.error)}</ErrorBanner>
          )}
        </Styled.ContextForm>
      </Styled.DetailLayout>
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
  );
}
