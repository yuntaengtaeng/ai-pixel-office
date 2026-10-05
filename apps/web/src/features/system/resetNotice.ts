/** 데이터 초기화 안내 표시 여부 (초기화 시각이 있고 아직 확인하지 않았으면 표시) */
export function shouldShowResetNotice(resetAt: string | undefined, seenAt: string | null): boolean {
  return Boolean(resetAt) && resetAt !== seenAt;
}
