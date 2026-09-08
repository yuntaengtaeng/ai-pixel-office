import { useMutation } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import { useAlertDialog } from "../../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../../shared/lib/errors.ts";
import { AlertDialog } from "../../../shared/ui/FeedbackDialogs.tsx";

const Styled = {
  Card: styled.article<{ $connected: boolean }>`
    display: grid;
    grid-template-columns: 12px minmax(0, 1fr);
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid
      ${({ theme, $connected }) =>
        $connected ? theme.colors.border.positive : theme.colors.border.subtle};
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
  Light: styled.span<{ $state: "connected" | "warning" | "default" }>`
    width: 10px;
    height: 10px;
    margin-top: ${({ theme }) => theme.space.x1};
    background: ${({ theme }) => theme.colors.semantic.negative};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.border.negative};

    ${({ $state, theme }) =>
      $state === "connected" &&
      `background: ${theme.colors.brand.primary}; box-shadow: 0 0 0 2px ${theme.colors.border.positive};`}
    ${({ $state, theme }) =>
      $state === "warning" &&
      `background: ${theme.colors.semantic.warning}; box-shadow: 0 0 0 2px ${theme.colors.border.subtle};`}
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
  Action: styled(Button)`
    margin-top: ${({ theme }) => theme.space.x2};
  `,
  Hint: styled.p`
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

export function ConnectionCard({
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
  showDeveloperOptions = true,
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
  showDeveloperOptions?: boolean;
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
    onSuccess: () => onStatusRefresh?.(),
  });
  const configureMcp = useMutation({
    mutationFn: async () => {
      if (!mcpRuntime || !window.pixelOffice)
        throw new Error("데스크톱 앱에서만 등록할 수 있습니다.");
      const result = await window.pixelOffice.configureFigmaMcp(mcpRuntime);
      if (!result.ok) throw new Error(result.message);
      return result;
    },
    onSuccess: () => onStatusRefresh?.(),
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
      <Styled.Card $connected={connected}>
        <Styled.Light $state={lightState} />
        <div>
          <strong>{name}</strong>
          <p>{detail}</p>
          {version && <small>{version}</small>}
          {canInstall && (
            <Styled.Action
              $variant="secondary"
              type="button"
              onClick={() => install.mutate()}
              disabled={install.isPending}
            >
              {install.isPending ? "AI를 준비하는 중…" : "AI 준비하기"}
            </Styled.Action>
          )}
          {install.isSuccess && (
            <Styled.Hint>설치가 끝났습니다. 상태를 다시 확인하고 있어요.</Styled.Hint>
          )}
          {install.isError && <Styled.Hint data-error>{messageOf(install.error)}</Styled.Hint>}
          {canConnect && (
            <Styled.Action
              $variant="primary"
              type="button"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
            >
              {connect.isPending ? "로그인 창을 여는 중…" : "로그인하고 연결하기"}
            </Styled.Action>
          )}
          {connect.isSuccess && (
            <Styled.Hint>브라우저 로그인을 마치면 연결 상태가 자동으로 갱신됩니다.</Styled.Hint>
          )}
          {connect.isError && <Styled.Hint data-error>{messageOf(connect.error)}</Styled.Hint>}
          {canConfigureMcp && (
            <Styled.Action
              $variant="secondary"
              type="button"
              onClick={() => configureMcp.mutate()}
              disabled={configureMcp.isPending}
            >
              {configureMcp.isPending ? "등록하는 중…" : "MCP 등록하기"}
            </Styled.Action>
          )}
          {configureMcp.isError && (
            <Styled.Hint data-error>{messageOf(configureMcp.error)}</Styled.Hint>
          )}
          {canConnectMcp && (
            <Styled.Action
              $variant="secondary"
              type="button"
              onClick={() => connectMcp.mutate()}
              disabled={connectMcp.isPending}
            >
              {connectMcp.isPending
                ? "여는 중…"
                : mcpRuntime === "claude"
                  ? "터미널에서 로그인 확인하기"
                  : "브라우저로 로그인하기"}
            </Styled.Action>
          )}
          {connectMcp.isError && (
            <Styled.Hint data-error>{messageOf(connectMcp.error)}</Styled.Hint>
          )}
          {showDeveloperOptions && (
            <Styled.DeveloperOptions>
              <summary>터미널 명령 보기</summary>
              <Styled.StaticHint>
                터미널을 직접 사용하려면 아래 명령어를 복사해 실행하세요.
              </Styled.StaticHint>
              {[command, secondaryCommand].filter(Boolean).map((value) => (
                <Styled.CommandRow key={value}>
                  <code>{value}</code>
                  <Button $variant="secondary" type="button" onClick={() => void copy(value!)}>
                    복사
                  </Button>
                </Styled.CommandRow>
              ))}
            </Styled.DeveloperOptions>
          )}
        </div>
      </Styled.Card>
      <AlertDialog {...dialogProps} />
    </>
  );
}
