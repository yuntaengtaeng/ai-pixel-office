import { mediaQuery } from "@ai-pixel-office/design-system";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Field, HelperText, Input, Panel, Select } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { agentApi } from "../agents/api.ts";
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

const Styled = {
  Layout: styled(BaseLayout)`
    width: min(1040px, 100%);
  `,
  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.space.x5};
    align-items: stretch;

    @media ${mediaQuery.xl} {
      grid-template-columns: 1fr;
    }
  `,
  Section: styled(Panel).attrs({ as: "section" })`
    grid-column: 1 / -1;
    padding: ${({ theme }) => theme.space.x4};
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
  `,
  WorkspaceForm: styled(Panel).attrs({ as: "form" })`
    grid-column: 1 / -1;
    min-width: 0;
    padding: ${({ theme }) => theme.space.x4};
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
  `,
  WorkDirectorySettings: styled(Panel).attrs({ as: "section" })`
    grid-column: 1 / -1;
    min-width: 0;
  `,
  WorkDirectoryBody: styled.div`
    padding: ${({ theme }) => theme.space.x4};
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
  `,
  ProjectAddForm: styled.form`
    display: grid;
    grid-template-columns: minmax(180px, 0.7fr) minmax(280px, 1.3fr);
    gap: ${({ theme }) => theme.space.x2};

    @media ${mediaQuery.md} {
      display: grid;
      grid-template-columns: 1fr;
    }
  `,
  ProjectActions: styled.div`
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};

    @media ${mediaQuery.md} {
      justify-content: stretch;

      button {
        flex: 1;
      }
    }
  `,
  ProjectDirectoryList: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
  `,
  ProjectRow: styled.article`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
  `,
  ProjectSelectButton: styled.div`
    min-width: 0;
    padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x3}`};
    border: 0;
    background: transparent;
    text-align: left;
    display: grid;
    gap: ${({ theme }) => theme.space.x1};

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
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.space.x3};

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  ConnectionDescription: styled.p`
    margin: -${({ theme }) => theme.space.x2} 0 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    line-height: 1.55;
  `,
  OptionalSection: styled(Panel).attrs({ as: "section" })`
    grid-column: 1 / -1;
    min-width: 0;
    padding: ${({ theme }) => theme.space.x4};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
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
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }

    small {
      color: ${({ theme }) => theme.colors.text.muted};
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
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
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
  `,
  SettingsActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};
  `,
  DesktopConnectButton: styled(Button).attrs({ $variant: "primary" as const })`
    margin-top: ${({ theme }) => theme.space.x2};
  `,
  DesktopInstallButton: styled(Button).attrs({ $variant: "secondary" as const })`
    margin-top: ${({ theme }) => theme.space.x2};
  `,
  McpConnectButton: styled(Button).attrs({ $variant: "secondary" as const })`
    min-height: 32px;
    margin-top: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x3}`};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
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
  StaticHint: styled.p`
    && {
      margin-top: ${({ theme }) => theme.space.x2};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
    }
  `,
  DeveloperOptions: styled.details`
    margin-top: ${({ theme }) => theme.space.x3};

    summary {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      cursor: pointer;
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
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [defaultAgentId, setDefaultAgentId] = useState(workspace.defaultAgentId ?? "");
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  useEffect(() => {
    setWorkspaceName(workspace.name);
    setDefaultAgentId(workspace.defaultAgentId ?? "");
  }, [workspace]);
  const save = useMutation({
    mutationFn: () =>
      workspaceApi.update(workspace.id, {
        name: workspaceName,
        defaultAgentId: defaultAgentId || null,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workspace"] }),
  });
  const addProject = useMutation({
    mutationFn: () =>
      projectApi.create({ workspaceId: workspace.id, name: projectName, path: projectPath }),
    onSuccess: () => {
      setProjectName("");
      setProjectPath("");
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
    <Styled.Layout>
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
            <h2>AI 연결</h2>
            <span>필수</span>
          </SectionHeading>
          <Styled.ConnectionDescription>
            AI 동료가 작업을 실행할 수 있도록 사용할 서비스를 연결하세요.
          </Styled.ConnectionDescription>
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
          <Field>
            <label>기본 동료</label>
            <Select
              value={defaultAgentId}
              onChange={(event) => setDefaultAgentId(event.target.value)}
            >
              <option value="">매번 선택</option>
              {(agents.data ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
            <HelperText>설정하면 새 대화 시작 시 동료 선택 없이 바로 시작해요</HelperText>
          </Field>
          <Styled.SettingsActions>
            <Button $variant="primary" disabled={save.isPending || !workspaceName.trim()}>
              설정 저장
            </Button>
          </Styled.SettingsActions>
          {save.isError && <ErrorBanner>{messageOf(save.error)}</ErrorBanner>}
        </Styled.WorkspaceForm>
        <Styled.WorkDirectorySettings>
          <Styled.WorkDirectoryBody>
            <SectionHeading $compact>
              <h2>연결된 작업 폴더</h2>
              <span>{projects.data?.length ?? 0}</span>
            </SectionHeading>
            <HelperText>
              AI 동료가 참고하거나 결과를 저장할 코드·기획·디자인 폴더를 연결하세요. 폴더를 연결하지
              않아도 일반 작업은 시작할 수 있습니다.
            </HelperText>
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
              <Styled.ProjectActions>
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
              </Styled.ProjectActions>
            </Styled.ProjectAddForm>
            <Styled.ProjectDirectoryList>
              {(projects.data ?? [])
                .filter((project) => project.path)
                .map((project) => (
                  <Styled.ProjectRow key={project.id}>
                    <Styled.ProjectSelectButton>
                      <strong>{project.name}</strong>
                      <span title={project.path}>{project.path}</span>
                    </Styled.ProjectSelectButton>
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
          </Styled.WorkDirectoryBody>
        </Styled.WorkDirectorySettings>
        <Styled.OptionalSection>
          <SectionHeading $compact>
            <h2>외부 도구 연결</h2>
            <span>선택 사항</span>
          </SectionHeading>
          <Styled.ConnectionDescription>
            Figma를 연결하면 AI 동료가 디자인 파일을 참고할 수 있어요. 연결하지 않아도 일반 작업은
            그대로 사용할 수 있습니다.
          </Styled.ConnectionDescription>
          {status.data && (
            <Styled.ConnectionList>
              <ConnectionCard
                name="Figma · Codex"
                installed={status.data.mcp.figma.codex.configured}
                connected={
                  status.data.mcp.figma.codex.configured &&
                  status.data.mcp.figma.codex.enabled &&
                  status.data.mcp.figma.codex.authenticated === true
                }
                detail={status.data.mcp.figma.codex.detail}
                command="codex mcp add figma --url https://mcp.figma.com/mcp"
                secondaryCommand="codex mcp login figma"
                mcpRuntime="codex"
                onStatusRefresh={() => void status.refetch()}
              />
              <ConnectionCard
                name="Figma · Claude"
                installed={status.data.mcp.figma.claude.configured}
                connected={status.data.mcp.figma.claude.authenticated === true}
                detail={status.data.mcp.figma.claude.detail}
                command="claude mcp add --transport http --scope user figma-remote-mcp https://mcp.figma.com/mcp"
                secondaryCommand="claude"
                mcpRuntime="claude"
                onStatusRefresh={() => void status.refetch()}
              />
            </Styled.ConnectionList>
          )}
        </Styled.OptionalSection>
      </Styled.Grid>
      <ConfirmDialog {...dialogProps} />
    </Styled.Layout>
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
  mcpRuntime,
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
  mcpRuntime?: DesktopRuntime;
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
  const configureMcp = useMutation({
    mutationFn: async () => {
      if (!mcpRuntime || !window.pixelOffice)
        throw new Error("데스크톱 앱에서만 등록할 수 있습니다.");
      const result = await window.pixelOffice.configureFigmaMcp(mcpRuntime);
      if (!result.ok) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      onStatusRefresh?.();
    },
  });
  const connectMcp = useMutation({
    mutationFn: async () => {
      if (!mcpRuntime || !window.pixelOffice)
        throw new Error("데스크톱 앱에서만 연결할 수 있습니다.");
      return window.pixelOffice.connectFigmaMcp(mcpRuntime);
    },
    onSuccess: () => {
      window.setTimeout(() => onStatusRefresh?.(), 1_500);
      window.setTimeout(() => onStatusRefresh?.(), 5_000);
    },
  });
  const canConnect = Boolean(runtime && window.pixelOffice?.isDesktop && installed && !connected);
  const canInstall = Boolean(runtime && window.pixelOffice?.isDesktop && !installed);
  const canConfigureMcp = Boolean(mcpRuntime && window.pixelOffice?.isDesktop && !installed);
  const canConnectMcp = Boolean(
    mcpRuntime && window.pixelOffice?.isDesktop && installed && !connected,
  );
  const isClaudeMcpLogin = mcpRuntime === "claude" && canConnectMcp;
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
              {install.isPending ? "AI를 준비하는 중…" : "AI 준비하기"}
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
              {connect.isPending ? "로그인 창을 여는 중…" : "로그인하고 연결하기"}
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
          {canConfigureMcp && (
            <Styled.DesktopInstallButton
              type="button"
              onClick={() => configureMcp.mutate()}
              disabled={configureMcp.isPending}
            >
              {configureMcp.isPending ? "등록하는 중…" : "MCP 등록하기"}
            </Styled.DesktopInstallButton>
          )}
          {configureMcp.isSuccess && (
            <Styled.ConnectionHint>
              등록이 끝났습니다. 상태를 다시 확인하고 있어요.
            </Styled.ConnectionHint>
          )}
          {configureMcp.isError && (
            <Styled.ConnectionHint data-error>
              {messageOf(configureMcp.error)}
            </Styled.ConnectionHint>
          )}
          {canConnectMcp && (
            <Styled.McpConnectButton
              type="button"
              onClick={() => connectMcp.mutate()}
              disabled={connectMcp.isPending}
            >
              {connectMcp.isPending
                ? "여는 중…"
                : isClaudeMcpLogin
                  ? "터미널에서 로그인 확인하기"
                  : "브라우저로 로그인하기"}
            </Styled.McpConnectButton>
          )}
          {connectMcp.isSuccess && (
            <Styled.ConnectionHint>
              {isClaudeMcpLogin
                ? "열린 터미널에서 /mcp 명령으로 로그인을 확인해 주세요."
                : "브라우저 로그인을 마치면 연결 상태가 자동으로 갱신됩니다."}
            </Styled.ConnectionHint>
          )}
          {connectMcp.isError && (
            <Styled.ConnectionHint data-error>{messageOf(connectMcp.error)}</Styled.ConnectionHint>
          )}
          <Styled.DeveloperOptions>
            <summary>터미널 명령 보기</summary>
            <Styled.StaticHint>
              터미널을 직접 사용하려면 아래 명령어를 복사해 실행하세요.
            </Styled.StaticHint>
            <Styled.CommandRow>
              <code>{command}</code>
              <Button $variant="secondary" type="button" onClick={() => void copy(command)}>
                복사
              </Button>
            </Styled.CommandRow>
            {secondaryCommand && (
              <Styled.CommandRow>
                <code>{secondaryCommand}</code>
                <Button
                  $variant="secondary"
                  type="button"
                  onClick={() => void copy(secondaryCommand)}
                >
                  복사
                </Button>
              </Styled.CommandRow>
            )}
          </Styled.DeveloperOptions>
        </div>
      </Styled.ConnectionCard>
      <AlertDialog {...dialogProps} />
    </>
  );
}
