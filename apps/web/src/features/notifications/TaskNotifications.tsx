import { colors, mediaQuery } from "@ai-pixel-office/design-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import type { Task, TaskStatus } from "@ai-pixel-office/domain/entities";
import { usePageVisibility } from "../../shared/hooks/usePageVisibility.ts";

type SnackbarItem = {
  id: string;
  title: string;
  message: string;
  taskId?: string;
  tone: "info" | "warning" | "danger";
};

type LiveNotice =
  | { kind: "task"; task: Task }
  | { kind: "session_warning"; task: Task }
  | { kind: "session_reached"; task: Task; reason?: string };

const IMPORTANT_STATUS: Partial<
  Record<TaskStatus, { title: string; message: string; tone: SnackbarItem["tone"] }>
> = {
  needs_review: {
    title: "검토가 필요합니다",
    message: "에이전트가 작업 결과를 준비했습니다.",
    tone: "info",
  },
  needs_input: {
    title: "입력이 필요합니다",
    message: "작업을 계속하려면 확인이 필요합니다.",
    tone: "warning",
  },
  blocked: {
    title: "작업이 막혔습니다",
    message: "에이전트가 진행하지 못한 원인을 확인해 주세요.",
    tone: "warning",
  },
  failed: {
    title: "작업에 실패했습니다",
    message: "실행 기록에서 실패 원인을 확인해 주세요.",
    tone: "danger",
  },
};

const snackbarIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
`;

const TONE_COLORS: Record<SnackbarItem["tone"], { border: string; background: string }> = {
  info: colors.feedback.info,
  warning: colors.feedback.warning,
  danger: colors.feedback.danger,
};

const Styled = {
  Region: styled.div`
    position: fixed;
    z-index: ${({ theme }) => theme.zIndex.notification};
    right: 22px;
    bottom: 22px;
    width: min(390px, calc(100vw - 28px));
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
    pointer-events: none;

    @media ${mediaQuery.md} {
      right: 14px;
      bottom: 14px;
    }
  `,
  Snackbar: styled.div<{ $tone: SnackbarItem["tone"] }>`
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: ${({ theme }) => theme.space.x3};
    align-items: center;
    padding: ${({ theme }) => `${theme.space.x4} ${theme.space.x11} ${theme.space.x4} ${theme.space.x4}`};
    border: 2px solid ${({ $tone }) => TONE_COLORS[$tone].border};
    background: ${({ $tone }) => TONE_COLORS[$tone].background};
    box-shadow: 5px 5px 0 ${({ theme }) => theme.colors.shadow.snackbar};
    line-height: 1.35;
    pointer-events: auto;
    animation: ${snackbarIn} 180ms ease-out;

    > div {
      min-width: 0;
      display: grid;
      gap: ${({ theme }) => theme.space.x1};
    }

    strong {
      color: ${({ theme }) => theme.colors.text.primary};
      font-size: ${({ theme }) => theme.typography.fontSize.base};
    }

    span {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
    }
  `,
  PermissionHint: styled.span`
    margin-top: ${({ theme }) => theme.space.x1};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  `,
  ActionButton: styled.button`
    border: 1px solid currentColor;
    background: ${({ theme }) => theme.colors.background.actionTranslucent};
    padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x2}`};
    color: ${({ theme }) => theme.colors.text.positive};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
    cursor: pointer;
  `,
  CloseButton: styled.button`
    position: absolute;
    top: 7px;
    right: 8px;
    width: 25px;
    height: 25px;
    padding: 0;
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.headingMd};
    line-height: 1;
    cursor: pointer;
  `,
};

export function TaskNotifications({ workspaceId }: { workspaceId: string }) {
  const visible = usePageVisibility();
  const visibleRef = useRef(visible);
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const [items, setItems] = useState<SnackbarItem[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const [permissionPromptVisible, setPermissionPromptVisible] = useState(true);
  const [permissionRequesting, setPermissionRequesting] = useState(false);
  const [permissionHint, setPermissionHint] = useState<string>();
  const seen = useRef(new Map<string, string>());

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
    const currentTaskId = taskIdFromPath(location.pathname);
    if (currentTaskId) {
      setItems((current) => current.filter((item) => item.taskId !== currentTaskId));
    }
  }, [location.pathname]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const announce = useCallback(
    (title: string, message: string, tone: SnackbarItem["tone"] = "info") => {
      const id = `${Date.now()}-${Math.random()}`;
      setItems((current) => [...current.slice(-2), { id, title, message, tone }]);
      window.setTimeout(() => dismiss(id), 9_000);
    },
    [dismiss],
  );

  const show = useCallback(
    (notice: LiveNotice) => {
      const task = notice.task;
      let copy: Omit<SnackbarItem, "id" | "taskId"> | undefined;
      if (notice.kind === "session_warning") {
        copy = {
          title: "작업 세션 한도가 얼마 남지 않았습니다",
          message: "한도에 도달하면 같은 세션의 한도를 늘려 계속할 수 있습니다.",
          tone: "warning",
        };
      } else if (notice.kind === "session_reached") {
        copy = {
          title: "작업 세션이 일시 중단되었습니다",
          message:
            notice.reason === "inactivity"
              ? "5분 동안 새 진행이 없어 멈췄습니다. 현재 작업을 확인해 주세요."
              : "현재 진행 내용을 보존했습니다. 같은 세션의 한도를 늘려 계속할 수 있습니다.",
          tone: "warning",
        };
      } else {
        copy = IMPORTANT_STATUS[task.status];
      }
      if (!copy) return;
      const key = `${notice.kind}:${task.id}`;
      const notificationTag = `task:${task.id}`;
      const signature = `${task.status}:${task.updatedAt}:${copy.title}`;
      if (seen.current.get(key) === signature) return;
      seen.current.set(key, signature);

      if (visibleRef.current && taskIdFromPath(pathnameRef.current) === task.id) return;

      if (
        !visibleRef.current &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification(copy.title, {
          body: `${task.title} · ${copy.message}`,
          tag: notificationTag,
        });
        notification.onclick = () => {
          window.focus();
          navigate(`/tasks/${task.id}`);
          notification.close();
        };
        return;
      }

      const id = `${Date.now()}-${Math.random()}`;
      setItems((current) => [
        ...current.filter((item) => item.taskId !== task.id).slice(-2),
        { id, taskId: task.id, ...copy },
      ]);
      window.setTimeout(() => dismiss(id), 9_000);
    },
    [dismiss, navigate],
  );

  useEffect(() => {
    const stream = new EventSource(`/api/events?workspaceId=${encodeURIComponent(workspaceId)}`);
    const parseTask = (event: Event): Task | undefined => {
      try {
        const envelope = JSON.parse((event as MessageEvent<string>).data) as {
          data?: { task?: Task };
        };
        return envelope.data?.task;
      } catch {
        return undefined;
      }
    };
    const onTask = (event: Event) => {
      const task = parseTask(event);
      if (task) show({ kind: "task", task });
    };
    const onSessionWarning = (event: Event) => {
      const task = parseTask(event);
      if (task) show({ kind: "session_warning", task });
    };
    const onSessionReached = (event: Event) => {
      try {
        const envelope = JSON.parse((event as MessageEvent<string>).data) as {
          data?: { task?: Task; reason?: string };
        };
        if (envelope.data?.task) {
          show({
            kind: "session_reached",
            task: envelope.data.task,
            reason: envelope.data.reason,
          });
        }
      } catch {
        // A malformed optional notification must not interrupt live task updates.
      }
    };
    stream.addEventListener("task.status_changed", onTask);
    stream.addEventListener("session.limit_warning", onSessionWarning);
    stream.addEventListener("session.limit_reached", onSessionReached);
    return () => stream.close();
  }, [show, workspaceId]);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      setPermissionPromptVisible(false);
      announce(
        "알림을 사용할 수 없습니다",
        "현재 브라우저는 시스템 알림을 지원하지 않습니다.",
        "warning",
      );
      return;
    }
    if (!window.isSecureContext) {
      setPermissionHint("시스템 알림은 localhost 또는 HTTPS 환경에서만 켤 수 있습니다.");
      return;
    }

    setPermissionRequesting(true);
    setPermissionHint("브라우저의 알림 권한 요청을 확인해 주세요.");
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      if (next === "granted") {
        setPermissionPromptVisible(false);
        announce(
          "백그라운드 알림을 켰습니다",
          "다른 창을 보는 동안 검토와 입력 요청을 알려드릴게요.",
        );
        try {
          const confirmation = new Notification("AI Pixel Office 알림이 켜졌습니다", {
            body: "이제 중요한 작업 상태를 놓치지 않도록 알려드릴게요.",
            tag: "notification-permission-enabled",
          });
          window.setTimeout(() => confirmation.close(), 6_000);
        } catch {
          // The in-app confirmation still communicates success when the OS suppresses a test notice.
        }
      } else if (next === "denied") {
        setPermissionPromptVisible(false);
        announce(
          "브라우저에서 알림이 차단되었습니다",
          "주소 표시줄의 사이트 설정에서 알림 권한을 허용할 수 있습니다.",
          "warning",
        );
      } else {
        setPermissionHint(
          "권한 요청이 완료되지 않았습니다. 주소 표시줄의 사이트 설정에서 알림을 허용해 주세요.",
        );
      }
    } catch {
      setPermissionHint("알림 권한을 요청하지 못했습니다. 브라우저 사이트 설정을 확인해 주세요.");
    } finally {
      setPermissionRequesting(false);
    }
  };

  return (
    <Styled.Region aria-live="polite" aria-label="작업 상태 알림">
      {permission === "default" && permissionPromptVisible && (
        <Styled.Snackbar $tone="info">
          <div>
            <strong>백그라운드 작업 알림을 받을까요?</strong>
            <span>다른 창을 보고 있을 때 검토나 입력이 필요하면 알려드려요.</span>
            {permissionHint && <Styled.PermissionHint>{permissionHint}</Styled.PermissionHint>}
          </div>
          <Styled.ActionButton
            type="button"
            disabled={permissionRequesting}
            onClick={() => void requestPermission()}
          >
            {permissionRequesting ? "권한 확인 중..." : "알림 켜기"}
          </Styled.ActionButton>
          <Styled.CloseButton
            type="button"
            onClick={() => setPermissionPromptVisible(false)}
            aria-label="알림 설정 안내 닫기"
          >
            ×
          </Styled.CloseButton>
        </Styled.Snackbar>
      )}
      {items.map((item) => (
        <Styled.Snackbar $tone={item.tone} key={item.id}>
          <div>
            <strong>{item.title}</strong>
            <span>{item.message}</span>
          </div>
          {item.taskId && (
            <Styled.ActionButton
              type="button"
              onClick={() => {
                dismiss(item.id);
                navigate(`/tasks/${item.taskId}`);
              }}
            >
              작업 보기
            </Styled.ActionButton>
          )}
          <Styled.CloseButton type="button" onClick={() => dismiss(item.id)} aria-label="알림 닫기">
            ×
          </Styled.CloseButton>
        </Styled.Snackbar>
      ))}
    </Styled.Region>
  );
}

function taskIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/tasks\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}
