import { useState } from "react";
import type { NoticeTone } from "../types/notification.ts";

/** 브라우저 Notification 권한 요청과 배너 상태 관리, 결과 안내는 announce로 위임 */
export function useNotificationPermission(
  announce: (title: string, message: string, tone?: NoticeTone) => void,
) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const [promptVisible, setPromptVisible] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [hint, setHint] = useState<string>();

  const request = async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      setPromptVisible(false);
      announce(
        "알림을 사용할 수 없습니다",
        "현재 브라우저는 시스템 알림을 지원하지 않습니다.",
        "warning",
      );
      return;
    }
    if (!window.isSecureContext) {
      setHint("시스템 알림은 localhost 또는 HTTPS 환경에서만 켤 수 있습니다.");
      return;
    }

    setRequesting(true);
    setHint("브라우저의 알림 권한 요청을 확인해 주세요.");
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      if (next === "granted") {
        setPromptVisible(false);
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
        setPromptVisible(false);
        announce(
          "브라우저에서 알림이 차단되었습니다",
          "주소 표시줄의 사이트 설정에서 알림 권한을 허용할 수 있습니다.",
          "warning",
        );
      } else {
        setHint("권한 요청이 완료되지 않았습니다. 주소 표시줄의 사이트 설정에서 알림을 허용해 주세요.");
      }
    } catch {
      setHint("알림 권한을 요청하지 못했습니다. 브라우저 사이트 설정을 확인해 주세요.");
    } finally {
      setRequesting(false);
    }
  };

  return {
    permission,
    promptVisible,
    requesting,
    hint,
    request,
    dismissPrompt: () => setPromptVisible(false),
  };
}
