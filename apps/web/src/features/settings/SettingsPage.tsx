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
};

export function SettingsPage({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["system-status"],
    queryFn: systemApi.status,
    refetchOnWindowFocus: false,
  });
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
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
    </Styled.Layout>
  );
}
