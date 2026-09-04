import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Surface } from "@ai-pixel-office/ui";
import type { Input, Workspace } from "@ai-pixel-office/domain/entities";
import { inputApi } from "./api.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty, ErrorBanner } from "../../shared/ui/common.tsx";

const INPUT_TYPES: Array<{ value: Input["type"]; label: string }> = [
  { value: "request", label: "요청" },
  { value: "idea", label: "아이디어" },
  { value: "feedback", label: "피드백" },
  { value: "message", label: "메모" },
];

const Styled = {
  Surface: styled(Surface)`
    margin-bottom: 24px;
    padding: 22px;
    border-color: ${({ theme }) => theme.colors.blue};
    background:
      linear-gradient(135deg, rgb(77 127 138 / 10%), transparent 42%),
      ${({ theme }) => theme.colors.cream};
  `,
  Intro: styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;

    h2 {
      margin: 4px 0 5px;
      font-size: 20px;
    }

    p {
      max-width: 620px;
      margin: 0;
      color: ${({ theme }) => theme.colors.muted};
      font-size: 12px;
      line-height: 1.6;
    }
  `,
  Count: styled.span`
    flex: 0 0 auto;
    padding: 7px 10px;
    border: 1px solid #9ab8bd;
    background: #e4f0f2;
    color: #356974;
    font: 900 11px monospace;
  `,
  Flow: styled.ol`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0 0 14px;
    padding: 0;
    list-style: none;

    li {
      position: relative;
      min-height: 54px;
      padding: 10px 12px 10px 40px;
      border: 1px solid #c8d8d9;
      background: rgb(255 255 255 / 64%);
      color: #526361;
      font-size: 10px;
      line-height: 1.45;
    }

    b {
      position: absolute;
      top: 10px;
      left: 11px;
      display: grid;
      width: 20px;
      height: 20px;
      place-items: center;
      background: ${({ theme }) => theme.colors.blue};
      color: white;
      font: 900 10px monospace;
    }

    strong {
      display: block;
      color: #354b4f;
      font-size: 11px;
    }

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  Form: styled.form`
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: stretch;
    padding: 12px;
    border: 1px dashed #8eafb5;
    background: #f8fcfc;

    select,
    textarea {
      border: 1px solid #9fb7b9;
      background: white;
      color: ${({ theme }) => theme.colors.ink};
      font: inherit;
    }

    select {
      padding: 0 10px;
      font-size: 11px;
      font-weight: 800;
    }

    textarea {
      min-height: 58px;
      padding: 10px 12px;
      resize: vertical;
      font-size: 12px;
      line-height: 1.5;
    }

    @media (max-width: 760px) {
      grid-template-columns: 1fr;

      select {
        min-height: 38px;
      }
    }
  `,
  List: styled.div`
    display: grid;
    gap: 7px;
    max-height: 280px;
    margin-top: 10px;
    overflow: auto;
  `,
  Item: styled.article`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 10px;
    border: 1px solid #d9cdbd;
    background: #fffdfa;

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  ItemCopy: styled.div`
    min-width: 0;
    display: grid;
    gap: 4px;

    > div {
      display: flex;
      gap: 8px;
      color: ${({ theme }) => theme.colors.muted};
      font-size: 9px;

      span {
        color: #397080;
        font-weight: 900;
      }
    }

    strong,
    p {
      overflow: hidden;
      margin: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: 12px;
    }

    p {
      color: ${({ theme }) => theme.colors.muted};
      font-size: 10px;
    }
  `,
  ItemActions: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;

    @media (max-width: 760px) {
      justify-content: flex-end;
    }
  `,
  DeleteButton: styled.button`
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    color: #9b6b66;
    font-size: 19px;
    cursor: pointer;
  `,
};

export function InboxPanel({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [type, setType] = useState<Input["type"]>("request");
  const { confirm, dialogProps } = useConfirmDialog();
  const inputs = useQuery({
    queryKey: ["inputs", workspace.id, "inbox"],
    queryFn: () => inputApi.list(workspace.id),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["inputs", workspace.id] });
    void queryClient.invalidateQueries({ queryKey: ["activities", workspace.id] });
  };
  const create = useMutation({
    mutationFn: () => inputApi.create({ workspaceId: workspace.id, content: content.trim(), type }),
    onSuccess: () => {
      setContent("");
      refresh();
    },
  });
  const convert = useMutation({
    mutationFn: (id: string) => inputApi.convert(id),
    onSuccess: ({ task }) => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate(`/tasks/${task.id}`);
    },
  });
  const archive = useMutation({
    mutationFn: (id: string) => inputApi.update(id, { status: "archived" }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => inputApi.remove(id),
    onSuccess: refresh,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (content.trim()) create.mutate();
  };
  const error = inputs.error ?? create.error ?? convert.error ?? archive.error ?? remove.error;

  return (
    <Styled.Surface>
      <Styled.Intro>
        <div>
          <span className="kicker">CAPTURE FIRST</span>
          <h2>요청 보관함</h2>
          <p>
            여기에 적은 내용은 바로 AI 동료에게 전달되지 않습니다. 먼저 보관한 뒤 “작업으로
            만들기”를 눌러 담당 에이전트와 실행 범위를 확인해 주세요.
          </p>
        </div>
        <Styled.Count>{inputs.data?.length ?? 0}개 대기</Styled.Count>
      </Styled.Intro>
      <Styled.Flow aria-label="요청이 에이전트에게 전달되는 순서">
        <li>
          <b>1</b>
          <strong>내용 적기</strong>
          요청·아이디어를 안전하게 보관
        </li>
        <li>
          <b>2</b>
          <strong>작업으로 만들기</strong>
          제목과 목표를 확인
        </li>
        <li>
          <b>3</b>
          <strong>에이전트 배정</strong>
          담당자를 고른 뒤 실행
        </li>
      </Styled.Flow>
      <Styled.Form onSubmit={submit}>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as Input["type"])}
          aria-label="입력 종류"
        >
          {INPUT_TYPES.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              content.trim() &&
              !create.isPending
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="아직 작업으로 정리되지 않은 요청이나 아이디어를 빠르게 남겨보세요."
          rows={2}
        />
        <Button $variant="primary" disabled={!content.trim() || create.isPending}>
          {create.isPending ? "담는 중..." : "담아두기"}
        </Button>
      </Styled.Form>
      {error && <ErrorBanner>{messageOf(error)}</ErrorBanner>}
      <Styled.List>
        {(inputs.data ?? []).map((input) => (
          <Styled.Item key={input.id}>
            <Styled.ItemCopy>
              <div>
                <span>
                  {INPUT_TYPES.find((item) => item.value === input.type)?.label ?? "입력"}
                </span>
                <time>{relativeTime(input.createdAt)}</time>
              </div>
              <strong>{input.title ?? input.content}</strong>
              {input.title && <p>{input.content}</p>}
            </Styled.ItemCopy>
            <Styled.ItemActions>
              <Button
                $variant="primary"
                onClick={() => convert.mutate(input.id)}
                disabled={convert.isPending}
              >
                작업으로 만들기
              </Button>
              <Button
                $variant="secondary"
                onClick={() => archive.mutate(input.id)}
                disabled={archive.isPending}
              >
                보관
              </Button>
              <Styled.DeleteButton
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Inbox 항목을 삭제할까요?",
                      description: "삭제한 입력은 다시 복구할 수 없습니다.",
                      confirmLabel: "삭제",
                      tone: "danger",
                    })
                  )
                    remove.mutate(input.id);
                }}
                disabled={remove.isPending}
                aria-label="Inbox 항목 삭제"
              >
                ×
              </Styled.DeleteButton>
            </Styled.ItemActions>
          </Styled.Item>
        ))}
        {!inputs.isPending && inputs.data?.length === 0 && (
          <Empty>떠오른 내용을 적어두면 나중에 작업으로 바꿀 수 있어요.</Empty>
        )}
      </Styled.List>
      <ConfirmDialog {...dialogProps} />
    </Styled.Surface>
  );
}
