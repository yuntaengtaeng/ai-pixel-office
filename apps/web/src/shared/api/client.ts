type ApiEnvelope<T> = { data: T };
type ApiError = { error?: { code?: string; message?: string } };

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 실행 창에서 서버 상태를 확인해 주세요.");
  }
  if (response.status === 204 && response.ok) return undefined as T;
  const text = await response.text();
  let body: (ApiEnvelope<T> & ApiError) | undefined;
  try {
    body = text ? (JSON.parse(text) as ApiEnvelope<T> & ApiError) : undefined;
  } catch {
    throw new Error(`서버 응답을 읽지 못했습니다 (HTTP ${response.status})`);
  }
  if (!response.ok || !body || !("data" in body)) {
    const fallback =
      response.status >= 500
        ? "서버에 연결할 수 없습니다. 실행 창에서 서버 상태를 확인해 주세요."
        : `요청에 실패했습니다 (HTTP ${response.status})`;
    throw new Error(body?.error?.message ?? fallback);
  }
  return body.data;
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}
