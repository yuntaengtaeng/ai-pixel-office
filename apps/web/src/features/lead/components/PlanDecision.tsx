import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, TextArea } from "@ai-pixel-office/design-system";
import type { LeadPlan } from "@ai-pixel-office/domain/entities";
import { leadApi } from "../api.ts";
import { messageOf } from "../../../shared/lib/errors.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";

const Styled = {
  Actions: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
  `,
  Decided: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  `,
};

/** 결재·반려가 끝난 계획서의 한 줄 안내 (의견 없이 닫았으면 진행하지 않기로 한 것) */
function decidedLabel(plan: LeadPlan): string {
  if (plan.status === "approved") return "결재했어요. 기안서가 만들어졌어요.";
  return plan.feedback
    ? `반려했어요. "${plan.feedback}" 의견으로 팀장이 다시 계획해요.`
    : "이 계획서는 진행하지 않아요. 만들어진 기안서는 없어요.";
}

/** 계획서 결재·반려·진행하지 않기 (반려하면 의견이 팀장에게 전해져 새 계획서를 받음) */
export function PlanDecision({ plan, onDecided }: { plan: LeadPlan; onDecided: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const approve = useMutation({ mutationFn: () => leadApi.approve(plan.id), onSuccess: onDecided });
  const reject = useMutation({
    mutationFn: () => leadApi.reject(plan.id, feedback.trim()),
    onSuccess: onDecided,
  });
  const discard = useMutation({ mutationFn: () => leadApi.discard(plan.id), onSuccess: onDecided });
  const pending = approve.isPending || reject.isPending || discard.isPending;

  if (plan.status !== "proposed") {
    return <Styled.Decided>{decidedLabel(plan)}</Styled.Decided>;
  }
  return (
    <Styled.Actions>
      {rejecting ? (
        <>
          <TextArea
            aria-label="반려 의견"
            rows={3}
            placeholder="예) 명세는 건너뛰고 바로 만들어 줘"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
          <Button
            type="button"
            $variant="secondary"
            disabled={!feedback.trim() || pending}
            onClick={() => reject.mutate()}
          >
            의견 보내고 반려
          </Button>
          <Button type="button" $variant="secondary" onClick={() => setRejecting(false)}>
            취소
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            $variant="stamp"
            disabled={pending}
            onClick={() => approve.mutate()}
          >
            {approve.isPending ? "기안서를 만드는 중" : "결재하고 시작"}
          </Button>
          <Button
            type="button"
            $variant="secondary"
            disabled={pending}
            onClick={() => setRejecting(true)}
          >
            의견 달아 반려
          </Button>
          <Button
            type="button"
            $variant="secondary"
            disabled={pending}
            onClick={() => discard.mutate()}
          >
            진행하지 않기
          </Button>
        </>
      )}
      {(approve.error ?? reject.error ?? discard.error) && (
        <ErrorBanner>{messageOf(approve.error ?? reject.error ?? discard.error)}</ErrorBanner>
      )}
    </Styled.Actions>
  );
}
