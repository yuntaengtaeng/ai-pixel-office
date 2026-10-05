import { useState } from "react";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import { shouldShowResetNotice } from "./resetNotice.ts";

const SEEN_KEY = "legacy-data-reset-seen";

function readSeenAt(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

const Notice = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.x3};
  margin: ${({ theme }) => `${theme.space.x4} ${theme.space.x6} 0`};
  padding: ${({ theme }) => `${theme.space.x3} ${theme.space.x4}`};
  border: 1px solid ${({ theme }) => theme.colors.feedback.info.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.feedback.info.background};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  line-height: 1.5;
`;

/** 이전 버전 데이터가 초기화된 뒤 처음 한 번 보여주는 안내 */
export function LegacyResetNotice({ resetAt }: { resetAt?: string }) {
  const [seenAt, setSeenAt] = useState(readSeenAt);
  if (!shouldShowResetNotice(resetAt, seenAt)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, resetAt ?? "");
    } catch {
      // 저장하지 못하면 이번 화면에서만 닫힘
    }
    setSeenAt(resetAt ?? null);
  };

  return (
    <Notice role="status">
      <span>
        새 버전으로 바뀌면서 이전 버전의 동료, 스킬, 작업 기록을 정리했어요. 연결했던 프로젝트
        폴더와 파일은 그대로예요.
      </span>
      <Button type="button" $variant="secondary" onClick={dismiss}>
        확인
      </Button>
    </Notice>
  );
}
