import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Workspace } from "../../../../../packages/domain/src/entities.ts";
import { projectApi } from "../projects/api.ts";
import { systemApi } from "../system/api.ts";
import { workspaceApi } from "../workspaces/api.ts";
import { useAlertDialog, useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { AlertDialog, ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty, ErrorBanner, PageHeader } from "../../shared/ui/common.tsx";
import { ProjectDirectorySelect } from "../projects/ProjectSelect.tsx";

export function SettingsPage({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();
  const status = useQuery({
    queryKey: ["system-status"],
    queryFn: systemApi.status,
    refetchOnWindowFocus: false,
  });
  const projects = useQuery({
    queryKey: ["projects", workspace.id],
    queryFn: () => projectApi.list(workspace.id),
  });
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [workingDirectory, setWorkingDirectory] = useState(workspace.workingDirectory ?? "");
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  useEffect(() => {
    setWorkspaceName(workspace.name);
    setWorkingDirectory(workspace.workingDirectory ?? "");
  }, [workspace]);
  const save = useMutation({
    mutationFn: () =>
      workspaceApi.update(workspace.id, {
        name: workspaceName,
        workingDirectory: workingDirectory.trim() || "",
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workspace"] }),
  });
  const addProject = useMutation({
    mutationFn: () =>
      projectApi.create({ workspaceId: workspace.id, name: projectName, path: projectPath }),
    onSuccess: (project) => {
      setProjectName("");
      setProjectPath("");
      if ((projects.data?.length ?? 0) === 0 && !workingDirectory && project.path)
        setWorkingDirectory(project.path);
      void queryClient.invalidateQueries({ queryKey: ["projects", workspace.id] });
    },
  });
  const removeProject = useMutation({
    mutationFn: (id: string) => projectApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["projects", workspace.id] }),
  });
  const pickProject = useMutation({
    mutationFn: () => systemApi.pickDirectory(projectPath || undefined),
    onSuccess: (result) => {
      if (result.path) setProjectPath(result.path);
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="CONNECTION CENTER"
        title="실행 환경 설정"
        action={
          <button
            className="secondary-button"
            onClick={() => void status.refetch()}
            disabled={status.isFetching}
          >
            ↻ 상태 다시 확인
          </button>
        }
      />
      <div className="settings-grid">
        <section className="panel settings-section">
          <div className="section-heading compact">
            <h2>런타임 연결</h2>
            <span>LOCAL</span>
          </div>
          {status.isPending && <Empty>설치와 로그인 상태를 확인하는 중...</Empty>}
          {status.isError && <ErrorBanner>{messageOf(status.error)}</ErrorBanner>}
          {status.data && (
            <div className="connection-list">
              <ConnectionCard
                name="Codex"
                installed={status.data.codex.installed}
                connected={status.data.codex.authenticated}
                detail={status.data.codex.detail}
                version={status.data.codex.version}
                command="codex login"
              />
              <ConnectionCard
                name="Claude"
                installed={status.data.claude.installed}
                connected={status.data.claude.authenticated}
                detail={`${status.data.claude.detail} · 실행 후 /login 입력`}
                version={status.data.claude.version}
                command="claude"
              />
              <ConnectionCard
                name="Figma MCP · Codex"
                installed={status.data.figma.configured}
                connected={
                  status.data.figma.configured &&
                  status.data.figma.enabled &&
                  status.data.figma.authenticated === true
                }
                detail={status.data.figma.detail}
                command="codex mcp add figma --url https://mcp.figma.com/mcp"
                secondaryCommand="codex mcp login figma"
              />
              <ConnectionCard
                name="Figma · Claude"
                installed={status.data.figma.claudeConfigured}
                connected={status.data.figma.claudeAuthenticated === true}
                detail={status.data.figma.claudeDetail}
                command="claude mcp add --transport http --scope user figma-remote-mcp https://mcp.figma.com/mcp"
                secondaryCommand="claude"
              />
            </div>
          )}
        </section>
        <form
          className="panel settings-section"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="section-heading compact">
            <h2>워크스페이스</h2>
            <span>DEFAULT</span>
          </div>
          <div className="field">
            <label>이름</label>
            <input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              required
            />
          </div>
          <div className="settings-actions">
            <button className="primary-button" disabled={save.isPending || !workspaceName.trim()}>
              이름 저장
            </button>
          </div>
          {save.isError && <ErrorBanner>{messageOf(save.error)}</ErrorBanner>}
        </form>
        <details className="panel advanced-settings projects-section">
          <summary>
            <strong>개발자 옵션</strong>
            <span>로컬 프로젝트 폴더와 실행 위치를 관리합니다.</span>
          </summary>
          <div className="settings-section">
            <div className="section-heading compact">
              <h2>로컬 프로젝트 폴더</h2>
              <span>{projects.data?.length ?? 0}</span>
            </div>
            <p className="helper-copy">
              코드 작업이 필요한 경우에만 설정하세요. PM·디자인 대화에는 필요하지 않습니다.
            </p>
            <div className="advanced-default-row">
              <ProjectDirectorySelect
                workspaceId={workspace.id}
                value={workingDirectory}
                onChange={setWorkingDirectory}
                label="기본 실행 폴더"
                emptyLabel="서버 실행 폴더"
              />
              <button
                type="button"
                className="secondary-button"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                기본값 저장
              </button>
            </div>
            <form
              className="project-add-form"
              onSubmit={(event) => {
                event.preventDefault();
                addProject.mutate();
              }}
            >
              <div className="field">
                <label>프로젝트 이름</label>
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="예: 쇼핑몰 웹"
                  required
                />
              </div>
              <div className="field grow">
                <label>선택한 폴더</label>
                <input
                  value={projectPath}
                  onChange={(event) => setProjectPath(event.target.value)}
                  placeholder="폴더 찾아보기를 눌러 주세요"
                  required
                />
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={pickProject.isPending}
                onClick={() => pickProject.mutate()}
              >
                {pickProject.isPending ? "선택기 여는 중" : "폴더 찾아보기…"}
              </button>
              <button
                className="primary-button"
                disabled={addProject.isPending || !projectName.trim() || !projectPath.trim()}
              >
                등록
              </button>
            </form>
            <div className="project-directory-list">
              {(projects.data ?? [])
                .filter((project) => project.path)
                .map((project) => (
                  <article
                    key={project.id}
                    className={workingDirectory === project.path ? "selected" : ""}
                  >
                    <button
                      type="button"
                      className="project-select"
                      onClick={() => setWorkingDirectory(project.path!)}
                    >
                      <strong>{project.name}</strong>
                      <span title={project.path}>{project.path}</span>
                    </button>
                    <span>{workingDirectory === project.path ? "기본 선택" : ""}</span>
                    <button
                      type="button"
                      className="project-delete"
                      disabled={removeProject.isPending && removeProject.variables === project.id}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `${project.name} 프로젝트를 목록에서 삭제할까요?`,
                            description: "실제 폴더나 기존 작업은 삭제되지 않습니다.",
                            confirmLabel: "목록에서 삭제",
                            tone: "danger",
                          })
                        )
                          removeProject.mutate(project.id);
                      }}
                    >
                      삭제
                    </button>
                  </article>
                ))}
              {!projects.isPending && !(projects.data ?? []).some((project) => project.path) && (
                <Empty>로컬 폴더가 연결된 프로젝트가 없습니다.</Empty>
              )}
            </div>
            {(addProject.isError ||
              removeProject.isError ||
              pickProject.isError ||
              save.isError) && (
              <ErrorBanner>
                {messageOf(
                  addProject.error ?? removeProject.error ?? pickProject.error ?? save.error,
                )}
              </ErrorBanner>
            )}
          </div>
        </details>
      </div>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}

function ConnectionCard({
  name,
  installed,
  connected,
  detail,
  version,
  command,
  secondaryCommand,
}: {
  name: string;
  installed: boolean;
  connected: boolean;
  detail: string;
  version?: string;
  command: string;
  secondaryCommand?: string;
}) {
  const { alert, dialogProps } = useAlertDialog();
  const copy = async (value: string) => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(value);
    } catch {
      await alert({
        title: "명령을 복사하지 못했습니다.",
        description: "브라우저의 클립보드 권한을 확인한 뒤 다시 시도해 주세요.",
        tone: "danger",
      });
    }
  };
  return (
    <>
      <article className="connection-card">
        <span
          className={`connection-light ${connected ? "connected" : installed ? "warning" : ""}`}
        />
        <div>
          <strong>{name}</strong>
          <p>{detail}</p>
          {version && <small>{version}</small>}
          <div className="command-row">
            <code>{command}</code>
            <button type="button" onClick={() => void copy(command)}>
              복사
            </button>
          </div>
          {secondaryCommand && (
            <div className="command-row">
              <code>{secondaryCommand}</code>
              <button type="button" onClick={() => void copy(secondaryCommand)}>
                복사
              </button>
            </div>
          )}
        </div>
      </article>
      <AlertDialog {...dialogProps} />
    </>
  );
}
