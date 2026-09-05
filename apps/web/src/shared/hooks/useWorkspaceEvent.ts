import { useEffect, useRef } from "react";
import { subscribeWorkspaceEvent } from "../lib/workspaceEvents.ts";

/** 워크스페이스 공용 SSE 연결에서 지정한 이벤트 구독 */
export function useWorkspaceEvent(
  workspaceId: string,
  eventNames: string | string[],
  handler: (event: MessageEvent<string>) => void,
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  const names = Array.isArray(eventNames) ? eventNames : [eventNames];
  const namesKey = names.join(",");

  useEffect(() => {
    const unsubscribes = names.map((name) =>
      subscribeWorkspaceEvent(workspaceId, name, (event) => handlerRef.current(event)),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    // names는 매 렌더 새 배열이라 재구독 판단 기준을 namesKey 문자열로 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, namesKey]);
}
