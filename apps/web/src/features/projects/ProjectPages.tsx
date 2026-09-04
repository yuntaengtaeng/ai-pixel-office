import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project, Workspace } from "../../../../../packages/domain/src/entities.ts";
import { agentApi } from "../agents/api.ts";
import { taskApi } from "../tasks/api.ts";
import { projectApi } from "./api.ts";
import { projectStatusLabel } from "./presentation.ts";
import { PetPreview } from "../office/PetPreview.tsx";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty, ErrorBanner, FullScreenMessage, PageHeader } from "../../shared/ui/common.tsx";
import { TaskCard } from "../tasks/TaskCard.tsx";

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
    <>
      <PageHeader eyebrow="PROJECT ROOM" title="프로젝트" />
      <div className="project-layout">
        <form
          className="panel project-create"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div>
            <span className="kicker">NEW PROJECT</span>
            <h2>새 프로젝트 시작하기</h2>
            <p>목표와 작업을 한곳에 모아 팀이 같은 맥락에서 일하게 합니다.</p>
          </div>
          <div className="field">
            <label>프로젝트 이름</label>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 모바일 앱 리뉴얼"
              required
            />
          </div>
          <div className="field">
            <label>이 프로젝트에서 이루고 싶은 것 · 선택 사항</label>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="예: 신규 사용자가 첫 주문까지 막힘없이 도달하도록 주요 화면을 개선해요"
            />
            <small>정확하지 않아도 괜찮습니다. 나중에 언제든 바꿀 수 있어요.</small>
          </div>
          <div className="prompt-suggestions">
            {[
              "화면 사용성을 검토하고 개선안을 만들어요",
              "반복 업무를 자동화해 팀의 시간을 줄여요",
              "아이디어를 검증할 프로토타입을 만들어요",
            ].map((example) => (
              <button type="button" key={example} onClick={() => setDescription(example)}>
                {example}
              </button>
            ))}
          </div>
          <details className="technical-details">
            <summary>디자인 연결 · 선택 사항</summary>
            <div className="field">
              <label>Figma 링크</label>
              <input
                value={figmaUrl}
                onChange={(event) => setFigmaUrl(event.target.value)}
                placeholder="https://figma.com/design/..."
              />
            </div>
          </details>
          <button className="primary-button wide" disabled={!name.trim() || create.isPending}>
            {create.isPending ? "만드는 중..." : "프로젝트 만들기"}
          </button>
          {create.isError && <ErrorBanner>{messageOf(create.error)}</ErrorBanner>}
        </form>
        <section className="project-board">
          <div className="section-heading compact">
            <h2>진행 중인 프로젝트</h2>
            <span>{projects.data?.length ?? 0}</span>
          </div>
          <div className="project-card-grid">
            {(projects.data ?? []).map((project) => {
              const related = projectTasks.filter((task) => task.projectId === project.id);
              const completed = related.filter((task) => task.status === "done").length;
              return (
                <Link
                  className="panel project-card"
                  to={`/projects/${project.id}`}
                  key={project.id}
                >
                  <div>
                    <span className={`project-status project-${project.status}`}>
                      {projectStatusLabel(project.status)}
                    </span>
                    {project.figmaUrl && <span className="project-figma">FIGMA</span>}
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
                </Link>
              );
            })}
            {!projects.isPending && projects.data?.length === 0 && (
              <div className="panel">
                <Empty>첫 프로젝트를 만들어 보세요.</Empty>
              </div>
            )}
          </div>
          {projects.isError && <ErrorBanner>{messageOf(projects.error)}</ErrorBanner>}
        </section>
      </div>
    </>
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
    <>
      <button className="back-button" onClick={() => navigate("/projects")}>
        ← 프로젝트 목록
      </button>
      <div className="project-detail-heading">
        <div>
          <span className={`project-status project-${status}`}>{projectStatusLabel(status)}</span>
          <h1>{projectQuery.data.name}</h1>
          <p>{projectQuery.data.description || "아직 프로젝트 목표가 없습니다."}</p>
        </div>
        <button
          type="submit"
          form="project-context-form"
          className="secondary-button"
          disabled={save.isPending || !name.trim()}
        >
          변경 저장
        </button>
      </div>
      <div className="project-detail-layout">
        <div className="project-main-column">
          <form
            className="panel project-task-create"
            onSubmit={(event) => {
              event.preventDefault();
              createTask.mutate();
            }}
          >
            <div className="section-heading compact">
              <h2>새 작업</h2>
              <span>담당자는 다음 화면에서 선택</span>
            </div>
            <div className="field">
              <label>무엇을 맡길까요?</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예: 결제 화면 사용성 검토"
                required
              />
            </div>
            <div className="field">
              <label>원하는 결과 · 선택 사항</label>
              <input
                value={result}
                onChange={(event) => setResult(event.target.value)}
                placeholder="예: 문제와 개선안을 우선순위로 정리해 주세요"
              />
            </div>
            <button className="primary-button" disabled={!title.trim() || createTask.isPending}>
              작업 만들기
            </button>
            {createTask.isError && <ErrorBanner>{messageOf(createTask.error)}</ErrorBanner>}
          </form>
          <section className="panel project-tasks">
            <div className="section-heading compact">
              <h2>프로젝트 작업</h2>
              <span>{relatedTasks.length}</span>
            </div>
            <div className="project-task-list">
              {relatedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  agent={(agents.data ?? []).find((agent) => agent.id === task.assigneeAgentId)}
                />
              ))}
              {relatedTasks.length === 0 && <Empty>첫 작업을 만들어 프로젝트를 시작하세요.</Empty>}
            </div>
          </section>
        </div>
        <form
          id="project-context-form"
          className="panel project-context"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() && !save.isPending) save.mutate();
          }}
        >
          <h2>프로젝트 맥락</h2>
          <div className="field">
            <label>이름</label>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="field">
            <label>목표</label>
            <textarea
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="field">
            <label>상태</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as Project["status"])}
            >
              <option value="active">진행 중</option>
              <option value="paused">잠시 멈춤</option>
              <option value="done">완료</option>
            </select>
          </div>
          <div className="field">
            <label>Figma 링크</label>
            <input
              value={figmaUrl}
              onChange={(event) => setFigmaUrl(event.target.value)}
              placeholder="선택 사항"
            />
          </div>
          {figmaUrl && (
            <a
              className="secondary-button project-figma-link"
              href={figmaUrl}
              target="_blank"
              rel="noreferrer"
            >
              Figma에서 열기 ↗
            </a>
          )}
          <div className="project-members">
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
          </div>
          <details className="technical-details">
            <summary>개발자 옵션</summary>
            <p className="path-note">
              {projectQuery.data.path || "연결된 로컬 폴더가 없습니다. 설정에서 연결할 수 있어요."}
            </p>
          </details>
          <button
            type="button"
            className="danger-button wide"
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
          </button>
          {(save.isError || remove.isError) && (
            <ErrorBanner>{messageOf(save.error ?? remove.error)}</ErrorBanner>
          )}
        </form>
      </div>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
