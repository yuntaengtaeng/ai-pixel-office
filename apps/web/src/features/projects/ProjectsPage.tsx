import { colors, mediaQuery } from "@ai-pixel-office/design-system";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import {
  Button,
  Field,
  Input,
  Kicker,
  Panel,
  panelStyles,
  TextArea,
} from "@ai-pixel-office/design-system";
import type { Project, Workspace } from "@ai-pixel-office/domain/entities";
import { taskApi } from "../tasks/api.ts";
import { projectApi } from "./api.ts";
import { projectStatusLabel } from "./presentation.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { PromptSuggestions } from "../../shared/ui/PromptSuggestions.tsx";
import { SectionHeading } from "../../shared/ui/SectionHeading.tsx";
import { TechnicalDetails } from "../../shared/ui/TechnicalDetails.tsx";
import { systemApi } from "../system/api.ts";

function folderName(path: string): string {
  return (
    path
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() ?? path
  );
}

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
      box-shadow: 0 0 0 1px ${({ theme }) => theme.colors.border.positive};
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
  ConnectionBadge: styled.span`
    width: fit-content;
    padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
    border: 1px solid ${({ theme }) => theme.colors.border.negative};
    background: ${({ theme }) => theme.colors.background.negativeSubtle};
    color: ${({ theme }) => theme.colors.text.negative};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
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
  const [hasEditedName, setHasEditedName] = useState(false);
  const [description, setDescription] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const pickProjectFolder = useMutation({
    mutationFn: () => systemApi.pickDirectory(projectPath || undefined),
    onSuccess: (result) => {
      if (!result.path) return;
      setProjectPath(result.path);
      if (!hasEditedName) setName(folderName(result.path));
    },
  });
  const create = useMutation({
    mutationFn: () =>
      projectApi.create({
        workspaceId: workspace.id,
        name,
        description: description.trim() || undefined,
        figmaUrl: figmaUrl.trim() || undefined,
        path: projectPath,
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
            <label>작업 폴더</label>
            <Input
              value={projectPath}
              readOnly
              placeholder="Claude와 Codex가 작업할 폴더를 선택해 주세요"
              required
            />
            <Button
              type="button"
              $variant="secondary"
              onClick={() => pickProjectFolder.mutate()}
              disabled={pickProjectFolder.isPending}
            >
              {pickProjectFolder.isPending ? "선택기 여는 중" : "폴더 선택"}
            </Button>
          </Field>
          <Field>
            <label>프로젝트 이름</label>
            <Input
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setHasEditedName(true);
              }}
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
          <Button
            $variant="primary"
            $fullWidth
            disabled={!name.trim() || !projectPath || create.isPending}
          >
            {create.isPending ? "만드는 중..." : "프로젝트 만들기"}
          </Button>
          {(create.isError || pickProjectFolder.isError) && (
            <ErrorBanner>{messageOf(create.error ?? pickProjectFolder.error)}</ErrorBanner>
          )}
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
                    {project.path ? (
                      <Styled.StatusBadge $status={project.status}>
                        {projectStatusLabel(project.status)}
                      </Styled.StatusBadge>
                    ) : (
                      <Styled.ConnectionBadge>연결 필요</Styled.ConnectionBadge>
                    )}
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
                <Empty title="아직 프로젝트가 없어요">
                  '새 프로젝트 시작하기' 폼에 이름만 입력해도 시작할 수 있어요.
                </Empty>
              </Panel>
            )}
          </Styled.CardGrid>
          {projects.isError && <ErrorBanner>{messageOf(projects.error)}</ErrorBanner>}
        </Styled.Board>
      </Styled.Layout>
    </BaseLayout>
  );
}
