import { mediaQuery } from "@ai-pixel-office/design-system";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import { Button, Kicker, Surface } from "@ai-pixel-office/design-system";
import type { Input, Workspace } from "@ai-pixel-office/domain/entities";
import { inputApi } from "./api.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { relativeTime } from "../../shared/lib/time.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { SectionHeadingCount } from "../../shared/ui/SectionHeading.tsx";

const INPUT_TYPES: Array<{ value: Input["type"]; label: string }> = [
  { value: "request", label: "요청" },
  { value: "idea", label: "아이디어" },
  { value: "feedback", label: "피드백" },
  { value: "message", label: "메모" },
];

const Styled = {
  Surface: styled(Surface)`
    margin-bottom: ${({ theme }) => theme.space.x6};
    padding: ${({ theme }) => theme.space.x6};
    border-top-color: ${({ theme }) => theme.colors.brand.secondary};
  `,
  Intro: styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x5};
    margin-bottom: ${({ theme }) => theme.space.x4};

    h2 {
      margin: ${({ theme }) => `${theme.space.x1} 0 ${theme.space.x1}`};
      font-size: ${({ theme }) => theme.typography.fontSize.headingMd};
    }

    p {
      max-width: 620px;
      margin: 0;
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      line-height: 1.6;
    }
  `,
  QuickAdd: styled.form`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    min-height: 40px;
    padding: 0 ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.default};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};
    margin-bottom: ${({ theme }) => theme.space.x4};

    select {
      border: 0;
      border-right: 1px solid ${({ theme }) => theme.colors.border.subtle};
      background: transparent;
      padding: 0 ${({ theme }) => theme.space.x2} 0 0;
      margin-right: ${({ theme }) => theme.space.x2};
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      color: ${({ theme }) => theme.colors.text.secondary};
    }

    input {
      min-width: 0;
      border: 0;
      outline: 0;
      padding: ${({ theme }) => theme.space.x2};
      background: transparent;
      font-size: ${({ theme }) => theme.typography.fontSize.compact};
      color: ${({ theme }) => theme.colors.text.primary};
      font-family: inherit;
    }

    button {
      border: 0;
      background: transparent;
      padding: 0 ${({ theme }) => theme.space.x2};
      color: ${({ theme }) => theme.colors.text.positive};
      font-weight: ${({ theme }) => theme.typography.fontWeight.black};
      cursor: pointer;

      &:disabled {
        color: ${({ theme }) => theme.colors.text.muted};
        cursor: not-allowed;
      }
    }
  `,
  List: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    max-height: 280px;
    margin-top: ${({ theme }) => theme.space.x3};
    overflow: auto;
  `,
  Item: styled.article`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: ${({ theme }) => theme.space.x3};
    align-items: center;
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    @media ${mediaQuery.md} {
      grid-template-columns: 1fr;
    }
  `,
  ItemCopy: styled.div`
    min-width: 0;
    display: grid;
    gap: ${({ theme }) => theme.space.x1};

    > div {
      display: flex;
      gap: ${({ theme }) => theme.space.x2};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.micro};

      span {
        color: ${({ theme }) => theme.colors.text.positive};
        font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
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
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }

    p {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }
  `,
  ItemActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};

    @media ${mediaQuery.md} {
      justify-content: flex-end;
    }
  `,
  DeleteButton: styled.button`
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.negative};
    font-size: ${({ theme }) => theme.typography.fontSize.headingSm};
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
          <Kicker>CAPTURE FIRST</Kicker>
          <h2>나중에 할 일</h2>
          <p>
            새 작업에서 보관해 둔 요청과 아이디어입니다. 준비가 되면 작업으로 바꿔 담당자를 정할 수
            있어요.
          </p>
        </div>
        <SectionHeadingCount>{inputs.data?.length ?? 0}개 대기</SectionHeadingCount>
      </Styled.Intro>
      <Styled.QuickAdd onSubmit={submit}>
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
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="떠오른 내용을 빠르게 남겨보세요"
        />
        <button type="submit" disabled={!content.trim() || create.isPending}>
          {create.isPending ? "담는 중..." : "+ 담기"}
        </button>
      </Styled.QuickAdd>
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
