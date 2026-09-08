import { mediaQuery } from "@ai-pixel-office/design-system";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Field, HelperText, Input, Panel, Select } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { agentApi } from "../agents/api.ts";
import { systemApi } from "../system/api.ts";
import { workspaceApi } from "../workspaces/api.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { SectionHeading } from "../../shared/ui/SectionHeading.tsx";
import { ConnectionCard } from "../system/components/ConnectionCard.tsx";
import { storageApi } from "./api.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";

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
  SettingsActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};
  `,
  StorageRows: styled.dl`
    margin: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    div { display: flex; justify-content: space-between; gap: ${({ theme }) => theme.space.x4}; }
    dt { color: ${({ theme }) => theme.colors.text.secondary}; }
    dd { margin: 0; font-weight: ${({ theme }) => theme.typography.fontWeight.bold}; }
  `,
  Danger: styled.div`
    padding-top: ${({ theme }) => theme.space.x3};
    border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};
  `,
  DangerDescription: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    line-height: 1.55;
  `,
  DangerCopy: styled.div`
    min-width: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x1};

    strong {
      line-height: 1.4;
    }
  `,
};

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function SettingsPage({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const { confirm, dialogProps } = useConfirmDialog();
  const status = useQuery({
    queryKey: ["system-status"],
    queryFn: systemApi.status,
    refetchOnWindowFocus: false,
  });
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const storage = useQuery({
    queryKey: ["storage", workspace.id],
    queryFn: () => storageApi.summary(workspace.id),
  });
  const clean = useMutation({
    mutationFn: (kind: "pending" | "completed") =>
      kind === "pending" ? storageApi.cleanPending(workspace.id) : storageApi.cleanCompleted(workspace.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storage", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
    },
  });
  const resetApp = useMutation({
    mutationFn: storageApi.reset,
    onSuccess: async () => {
      localStorage.clear();
      sessionStorage.clear();
      // An already-running Electron window may still have the previous preload contract.
      // Reload the renderer as a compatibility fallback; the next desktop launch has relaunch().
      if (typeof window.pixelOffice?.relaunch === "function") {
        await window.pixelOffice.relaunch();
      } else {
        window.location.reload();
      }
    },
  });
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [defaultAgentId, setDefaultAgentId] = useState(workspace.defaultAgentId ?? "");
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
  return (
    <Styled.Layout>
      <PageHeader
        eyebrow="SETTINGS"
        title="설정"
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
          <Styled.Danger>
            <Styled.DangerCopy>
              <strong>현재 워크스페이스 삭제</strong>
              <Styled.DangerDescription>
                현재 워크스페이스의 작업, 동료, 첨부와 이력만 삭제합니다.
              </Styled.DangerDescription>
            </Styled.DangerCopy>
            <Button type="button" $variant="danger" onClick={async () => {
              if (await confirm({ title: "워크스페이스를 삭제할까요?", description: "프로젝트 폴더의 원본은 유지되지만 이 워크스페이스의 앱 데이터는 되돌릴 수 없습니다.", confirmLabel: "워크스페이스 삭제", tone: "danger" })) {
                await workspaceApi.delete(workspace.id);
                window.location.reload();
              }
            }}>워크스페이스 삭제</Button>
          </Styled.Danger>
        </Styled.WorkspaceForm>
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
        <Styled.Section>
          <SectionHeading $compact>
            <h2>저장공간 및 데이터</h2>
            <span>로컬 저장</span>
          </SectionHeading>
          <Styled.ConnectionDescription>
            AI Pixel Office가 이 컴퓨터에 보관한 작업 이력과 첨부를 확인하고 정리합니다.
          </Styled.ConnectionDescription>
          {storage.isPending && <Empty>저장공간을 계산하는 중...</Empty>}
          {storage.isError && <ErrorBanner>{messageOf(storage.error)}</ErrorBanner>}
          {storage.data && (
            <Styled.StorageRows>
              <div><dt>전체 사용량</dt><dd>{size(storage.data.totalBytes)}</dd></div>
              <div><dt>첨부 파일</dt><dd>{size(storage.data.attachmentBytes)}</dd></div>
              <div><dt>앱 데이터베이스</dt><dd>{size(storage.data.databaseBytes)}</dd></div>
              <div><dt>실행 로그</dt><dd>{size(storage.data.runtimeLogBytes)}</dd></div>
              <div><dt>완료한 작업 {storage.data.completedTaskCount}개</dt><dd>{size(storage.data.completedTaskBytes)}</dd></div>
            </Styled.StorageRows>
          )}
          <Styled.Danger>
            <Styled.DangerCopy>
              <strong>불필요한 데이터 정리</strong>
              <Styled.DangerDescription>
                선택한 앱 데이터만 정리하며 프로젝트 폴더의 원본 파일은 유지합니다.
              </Styled.DangerDescription>
            </Styled.DangerCopy>
            <Styled.SettingsActions>
              <Button
                type="button"
                $variant="secondary"
                disabled={clean.isPending || !storage.data?.pendingAttachmentCount}
                onClick={async () => {
                  if (await confirm({ title: "미전송 첨부를 정리할까요?", description: `${storage.data?.pendingAttachmentCount ?? 0}개 파일을 삭제합니다.`, confirmLabel: "첨부 정리", tone: "danger" })) clean.mutate("pending");
                }}
              >{storage.data?.pendingAttachmentCount ? "미전송 첨부 정리" : "미전송 첨부 없음"}</Button>
              <Button
                type="button"
                $variant="danger"
                disabled={clean.isPending || !storage.data?.completedTaskCount}
                onClick={async () => {
                  if (await confirm({ title: "완료한 작업을 정리할까요?", description: "완료한 Task의 실행 이력과 첨부가 삭제되며 되돌릴 수 없습니다. 프로젝트 파일은 유지됩니다.", confirmLabel: "완료 작업 정리", tone: "danger" })) clean.mutate("completed");
                }}
              >{storage.data?.completedTaskCount ? "완료한 작업 정리" : "완료한 작업 없음"}</Button>
            </Styled.SettingsActions>
          </Styled.Danger>
          {clean.isError && <ErrorBanner>{messageOf(clean.error)}</ErrorBanner>}
          <Styled.Danger>
            <Styled.DangerCopy>
              <strong>AI Pixel Office 전체 데이터 초기화</strong>
              <Styled.DangerDescription>
                모든 워크스페이스와 앱이 보관한 로컬 데이터를 삭제합니다. 프로젝트 원본은 유지합니다.
              </Styled.DangerDescription>
            </Styled.DangerCopy>
            <Button type="button" $variant="danger" disabled={resetApp.isPending} onClick={async () => {
              if (await confirm({ title: "앱 데이터를 모두 초기화할까요?", description: "모든 Task, Agent, 실행 이력, 첨부와 일반 작업 폴더의 산출물이 삭제됩니다. Codex·Claude의 외부 로그인은 유지됩니다.", confirmLabel: "모든 데이터 초기화", tone: "danger" })) resetApp.mutate();
            }}>전체 데이터 초기화</Button>
          </Styled.Danger>
          {resetApp.isError && <ErrorBanner>{messageOf(resetApp.error)}</ErrorBanner>}
        </Styled.Section>
      </Styled.Grid>
      <ConfirmDialog {...dialogProps} />
    </Styled.Layout>
  );
}
