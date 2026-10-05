import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, TextArea } from "@ai-pixel-office/design-system";
import { leadApi } from "../api.ts";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";

const Styled = {
  Form: styled.form`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.space.x2};
    align-items: end;
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.background.surface};
    textarea {
      min-height: 44px;
      resize: vertical;
    }
  `,
};

/** 팀장에게 원하는 결과 말하기 (팀장이 답을 쓰는 동안은 멈추기만 할 수 있음) */
export function LeadComposer({
  projectId,
  replying,
  onSent,
}: {
  projectId: string;
  replying: boolean;
  onSent: () => void;
}) {
  const [draft, setDraft] = useState("");
  const send = useMutation({
    mutationFn: () => leadApi.send(projectId, draft.trim()),
    onSuccess: () => {
      setDraft("");
      onSent();
    },
  });
  const stop = useMutation({ mutationFn: () => leadApi.stop(projectId), onSuccess: onSent });
  const sendable = Boolean(draft.trim()) && !replying && !send.isPending;
  const submit = () => {
    if (sendable) send.mutate();
  };

  return (
    <>
      <Styled.Form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextArea
          aria-label="팀장에게 말하기"
          rows={2}
          value={draft}
          placeholder={
            replying
              ? "팀장이 답을 쓰고 있어요"
              : "원하는 결과를 말해 주세요. 예) 기획 화면에 감사 탭을 넣고 싶어"
          }
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        {replying ? (
          <Button
            type="button"
            $variant="secondary"
            disabled={stop.isPending}
            onClick={() => stop.mutate()}
          >
            {stop.isPending ? "멈추는 중" : "멈추기"}
          </Button>
        ) : (
          <Button type="submit" $variant="primary" disabled={!sendable}>
            {send.isPending ? "보내는 중" : "보내기"}
          </Button>
        )}
      </Styled.Form>
      {(send.error ?? stop.error) && (
        <ErrorBanner>{messageOf(send.error ?? stop.error)}</ErrorBanner>
      )}
    </>
  );
}
