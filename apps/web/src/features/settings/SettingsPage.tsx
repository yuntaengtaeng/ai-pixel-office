import { mediaQuery } from "@ai-pixel-office/design-system";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Field, HelperText, Input, Panel } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { projectApi } from "../projects/api.ts";
import { systemApi } from "../system/api.ts";
import { workspaceApi } from "../workspaces/api.ts";
import { useAlertDialog, useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { AlertDialog, ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { SectionHeading } from "../../shared/ui/SectionHeading.tsx";
import { ProjectDirectorySelect } from "../projects/ProjectSelect.tsx";

const Styled = {
  Grid: styled.div`
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: ${({ theme }) => theme.space.x5};
    align-items: start;

    @media ${mediaQuery.xl} {
      grid-template-columns: 1fr;
    }
  `,
  Section: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x5};
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  WorkspaceForm: styled(Panel).attrs({ as: "form" })`
    padding: ${({ theme }) => theme.space.x5};
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  AdvancedSettings: styled(Panel).attrs({ as: "details" })`
    grid-column: 1 / -1;

    > summary {
      padding: ${({ theme }) => `${theme.space.x4} ${theme.space.x5}`};
      display: flex;
      align-items: center;
      gap: ${({ theme }) => theme.space.x3};
      cursor: pointer;
      list-style-position: inside;

      strong {
        font-size: ${({ theme }) => theme.typography.fontSize.lg};
      }

      span {
        color: ${({ theme }) => theme.colors.text.muted};
        font-size: ${({ theme }) => theme.typography.fontSize.sm};
      }
    }

    &[open] > summary {
      border-bottom: 2px solid ${({ theme }) => theme.colors.border.subtle};
    }
  `,
  AdvancedSettingsBody: styled.div`
    padding: ${({ theme }) => theme.space.x5};
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  AdvancedDefaultRow: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: ${({ theme }) => theme.space.x2};

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  ProjectAddForm: styled.form`
    display: flex;
    align-items: end;
    gap: ${({ theme }) => theme.space.x2};

    @media ${mediaQuery.md} {
      display: grid;
    }
  `,
  ProjectDirectoryList: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
  `,
  ProjectRow: styled.article<{ $selected: boolean }>`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    ${({ $selected, theme }) =>
      $selected &&
      `
        border-color: ${theme.colors.brand.primary};
        background: ${theme.colors.background.positiveSubtle};
        box-shadow: inset 4px 0 ${theme.colors.brand.primary};
      `}

    > span {
      padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
      color: ${({ theme }) => theme.colors.text.positive};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }
  `,
  ProjectSelectButton: styled.button`
    min-width: 0;
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
    border: 0;
    background: transparent;
    text-align: left;
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
    cursor: pointer;

    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: ${({ theme }) => theme.colors.text.muted};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
  ProjectDeleteButton: styled.button`
    align-self: stretch;
    padding: ${({ theme }) => `0 ${theme.space.x3}`};
    border: 0;
    border-left: 1px dashed ${({ theme }) => theme.colors.shadow.default};
    background: ${({ theme }) => theme.colors.background.negativeSubtle};
    color: ${({ theme }) => theme.colors.text.negative};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    cursor: pointer;
  `,
  ConnectionList: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
  `,
  ConnectionCard: styled.article`
    display: grid;
    grid-template-columns: 12px minmax(0, 1fr);
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    > div {
      min-width: 0;
    }

    p {
      margin: ${({ theme }) => `${theme.space.x1} 0`};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }

    small {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-family: ${({ theme }) => theme.typography.fontFamily.mono};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
    }
  `,
  ConnectionLight: styled.span<{ $state: "connected" | "warning" | "default" }>`
    width: 10px;
    height: 10px;
    margin-top: ${({ theme }) => theme.space.x1};
    background: ${({ theme }) => theme.colors.semantic.negative};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.border.negative};

    ${({ $state, theme }) =>
      $state === "connected" &&
      `
        background: ${theme.colors.brand.primary};
        box-shadow: 0 0 0 2px ${theme.colors.border.positive};
      `}
    ${({ $state, theme }) =>
      $state === "warning" &&
      `
        background: ${theme.colors.semantic.warning};
        box-shadow: 0 0 0 2px ${theme.colors.border.subtle};
      `}
  `,
  CommandRow: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    margin-top: ${({ theme }) => theme.space.x2};

    code {
      min-width: 0;
      padding: ${({ theme }) => theme.space.x2};
      overflow: auto;
      background: ${({ theme }) => theme.colors.background.surfaceMuted};
      color: ${({ theme }) => theme.colors.text.primary};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      white-space: nowrap;
    }

    button {
      border: 1px solid ${({ theme }) => theme.colors.border.default};
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};
      cursor: pointer;
    }
  `,
  SettingsActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};
  `,
  DesktopConnectButton: styled.button`
    margin-top: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x3}`};
    border: 1px solid ${({ theme }) => theme.colors.brand.primaryDark};
    background: ${({ theme }) => theme.colors.brand.primary};
    color: white;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
    cursor: pointer;

    &:disabled {
      cursor: wait;
      opacity: 0.6;
    }
  `,
  DesktopInstallButton: styled.button`
    margin-top: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x3}`};
    border: 1px solid ${({ theme }) => theme.colors.brand.secondary};
    background: white;
    color: ${({ theme }) => theme.colors.brand.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
    cursor: pointer;

    &:disabled {
      cursor: wait;
      opacity: 0.6;
    }
  `,
  ConnectionHint: styled.p`
    && {
      margin-top: ${({ theme }) => theme.space.x2};
      color: ${({ theme }) => theme.colors.brand.primaryDark};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    }

    &[data-error] {
      color: ${({ theme }) => theme.colors.semantic.negative};
    }
  `,
};

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
    <BaseLayout>
      <PageHeader
        eyebrow="CONNECTION CENTER"
        title="실행 환경 설정"
        action={
          <Button
            $variant="secondary"
            onClick={() => void status.refetch()}
            disabled={status.isFetching}
          >
            ↻ 상태 다시 확인
          </Button>
        }
      />
      <Styled.Grid>
        <Styled.Section>
          <SectionHeading $compact>
            <h2>런타임 연결</h2>
            <span>LOCAL</span>
          </SectionHeading>
          {status.isPending && <Empty>설치와 로그인 상태를 확인하는 중...</Empty>}
          {status.isError && <ErrorBanner>{messageOf(status.error)}</ErrorBanner>}
          {status.data && (
            <Styled.ConnectionList>
              <ConnectionCard
                name="Codex"
                installed={status.data.codex.installed}
                connected={status.data.codex.authenticated}
                detail={status.data.codex.detail}
                version={status.data.codex.version}
                command="codex login"
                runtime="codex"
                onStatusRefresh={() => void status.refetch()}
              />
              <ConnectionCard
                name="Claude"
                installed={status.data.claude.installed}
                connected={status.data.claude.authenticated}
                detail={status.data.claude.detail}
                version={status.data.claude.version}
                command="claude auth login"
                runtime="claude"
                onStatusRefresh={() => void status.refetch()}
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
            </Styled.ConnectionList>
          )}
        </Styled.Section>
        <Styled.WorkspaceForm
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <SectionHeading $compact>
            <h2>워크스페이스</h2>
            <span>DEFAULT</span>
          </SectionHeading>
          <Field>
            <label>이름</label>
            <Input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              required
            />
          </Field>
          <Styled.SettingsActions>
            <Button $variant="primary" disabled={save.isPending || !workspaceName.trim()}>
              이름 저장
            </Button>
          </Styled.SettingsActions>
          {save.isError && <ErrorBanner>{messageOf(save.error)}</ErrorBanner>}
        </Styled.WorkspaceForm>
        <Styled.AdvancedSettings>
          <summary>
            <strong>개발자 옵션</strong>
            <span>로컬 프로젝트 폴더와 실행 위치를 관리합니다.</span>
          </summary>
          <Styled.AdvancedSettingsBody>
            <SectionHeading $compact>
              <h2>로컬 프로젝트 폴더</h2>
              <span>{projects.data?.length ?? 0}</span>
            </SectionHeading>
            <HelperText>
              코드 작업이 필요한 경우에만 설정하세요. PM·디자인 대화에는 필요하지 않습니다.
            </HelperText>
            <Styled.AdvancedDefaultRow>
              <ProjectDirectorySelect
                workspaceId={workspace.id}
                value={workingDirectory}
                onChange={setWorkingDirectory}
                label="기본 실행 폴더"
                emptyLabel="서버 실행 폴더"
              />
              <Button
                type="button"
                $variant="secondary"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                기본값 저장
              </Button>
            </Styled.AdvancedDefaultRow>
            <Styled.ProjectAddForm
              onSubmit={(event) => {
                event.preventDefault();
                addProject.mutate();
              }}
            >
              <Field>
                <label>프로젝트 이름</label>
                <Input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="예: 쇼핑몰 웹"
                  required
                />
              </Field>
              <Field $grow>
                <label>선택한 폴더</label>
                <Input
                  value={projectPath}
                  onChange={(event) => setProjectPath(event.target.value)}
                  placeholder="폴더 찾아보기를 눌러 주세요"
                  required
                />
              </Field>
              <Button
                type="button"
                $variant="secondary"
                disabled={pickProject.isPending}
                onClick={() => pickProject.mutate()}
              >
                {pickProject.isPending ? "선택기 여는 중" : "폴더 찾아보기…"}
              </Button>
              <Button
                $variant="primary"
                disabled={addProject.isPending || !projectName.trim() || !projectPath.trim()}
              >
                등록
              </Button>
            </Styled.ProjectAddForm>
            <Styled.ProjectDirectoryList>
              {(projects.data ?? [])
                .filter((project) => project.path)
                .map((project) => (
                  <Styled.ProjectRow key={project.id} $selected={workingDirectory === project.path}>
                    <Styled.ProjectSelectButton
                      type="button"
                      onClick={() => setWorkingDirectory(project.path!)}
                    >
                      <strong>{project.name}</strong>
                      <span title={project.path}>{project.path}</span>
                    </Styled.ProjectSelectButton>
                    <span>{workingDirectory === project.path ? "기본 선택" : ""}</span>
                    <Styled.ProjectDeleteButton
                      type="button"
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
                    </Styled.ProjectDeleteButton>
                  </Styled.ProjectRow>
                ))}
              {!projects.isPending && !(projects.data ?? []).some((project) => project.path) && (
                <Empty>로컬 폴더가 연결된 프로젝트가 없습니다.</Empty>
              )}
            </Styled.ProjectDirectoryList>
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
          </Styled.AdvancedSettingsBody>
        </Styled.AdvancedSettings>
      </Styled.Grid>
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
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
  runtime,
  onStatusRefresh,
}: {
  name: string;
  installed: boolean;
  connected: boolean;
  detail: string;
  version?: string;
  command: string;
  secondaryCommand?: string;
  runtime?: DesktopRuntime;
  onStatusRefresh?: () => void;
}) {
  const { alert, dialogProps } = useAlertDialog();
  const connect = useMutation({
    mutationFn: async () => {
      if (!runtime || !window.pixelOffice) throw new Error("데스크톱 앱에서만 연결할 수 있습니다.");
      return window.pixelOffice.connectRuntime(runtime);
    },
    onSuccess: () => {
      window.setTimeout(() => onStatusRefresh?.(), 1_500);
      window.setTimeout(() => onStatusRefresh?.(), 5_000);
    },
  });
  const install = useMutation({
    mutationFn: async () => {
      if (!runtime || !window.pixelOffice) throw new Error("데스크톱 앱에서만 설치할 수 있습니다.");
      const result = await window.pixelOffice.installRuntime(runtime);
      if (!result.ok) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      onStatusRefresh?.();
    },
  });
  const canConnect = Boolean(runtime && window.pixelOffice?.isDesktop && installed && !connected);
  const canInstall = Boolean(runtime && window.pixelOffice?.isDesktop && !installed);
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
  const lightState = connected ? "connected" : installed ? "warning" : "default";
  return (
    <>
      <Styled.ConnectionCard>
        <Styled.ConnectionLight $state={lightState} />
        <div>
          <strong>{name}</strong>
          <p>{detail}</p>
          {version && <small>{version}</small>}
          {canInstall && (
            <Styled.DesktopInstallButton
              type="button"
              onClick={() => install.mutate()}
              disabled={install.isPending}
            >
              {install.isPending ? "설치하는 중…" : "CLI 설치하기"}
            </Styled.DesktopInstallButton>
          )}
          {install.isSuccess && (
            <Styled.ConnectionHint>
              설치가 끝났습니다. 상태를 다시 확인하고 있어요.
            </Styled.ConnectionHint>
          )}
          {install.isError && (
            <Styled.ConnectionHint data-error>{messageOf(install.error)}</Styled.ConnectionHint>
          )}
          {canConnect && (
            <Styled.DesktopConnectButton
              type="button"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
            >
              {connect.isPending ? "로그인 여는 중…" : "브라우저로 연결하기"}
            </Styled.DesktopConnectButton>
          )}
          {connect.isSuccess && (
            <Styled.ConnectionHint>
              브라우저 로그인을 마치면 연결 상태가 자동으로 갱신됩니다.
            </Styled.ConnectionHint>
          )}
          {connect.isError && (
            <Styled.ConnectionHint data-error>{messageOf(connect.error)}</Styled.ConnectionHint>
          )}
          <Styled.CommandRow>
            <code>{command}</code>
            <button type="button" onClick={() => void copy(command)}>
              복사
            </button>
          </Styled.CommandRow>
          {secondaryCommand && (
            <Styled.CommandRow>
              <code>{secondaryCommand}</code>
              <button type="button" onClick={() => void copy(secondaryCommand)}>
                복사
              </button>
            </Styled.CommandRow>
          )}
        </div>
      </Styled.ConnectionCard>
      <AlertDialog {...dialogProps} />
    </>
  );
}
