type Listener = (event: MessageEvent<string>) => void;

type Connection = {
  source: EventSource;
  refCount: number;
};

const connections = new Map<string, Connection>();

function getConnection(workspaceId: string): Connection {
  const existing = connections.get(workspaceId);
  if (existing) return existing;
  const source = new EventSource(`/api/events?workspaceId=${encodeURIComponent(workspaceId)}`);
  const connection: Connection = { source, refCount: 0 };
  connections.set(workspaceId, connection);
  return connection;
}

/** 워크스페이스당 EventSource 한 개를 구독자끼리 공유, 호출부마다 새 연결 생성 방지 */
export function subscribeWorkspaceEvent(
  workspaceId: string,
  eventName: string,
  listener: Listener,
): () => void {
  const connection = getConnection(workspaceId);
  connection.refCount += 1;
  connection.source.addEventListener(eventName, listener as EventListener);

  return () => {
    connection.source.removeEventListener(eventName, listener as EventListener);
    connection.refCount -= 1;
    if (connection.refCount <= 0) {
      connection.source.close();
      connections.delete(workspaceId);
    }
  };
}
