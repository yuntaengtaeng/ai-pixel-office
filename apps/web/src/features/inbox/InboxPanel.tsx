import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Input, Workspace } from "../../../../../packages/domain/src/entities.ts";
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
    <section className="panel inbox-panel">
      <div className="section-heading compact">
        <h2>
          <span>▣</span> Inbox
        </h2>
        <span className="count">{inputs.data?.length ?? 0}</span>
      </div>
      <form className="inbox-capture" onSubmit={submit}>
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
        <button className="primary-button" disabled={!content.trim() || create.isPending}>
          {create.isPending ? "담는 중..." : "담아두기"}
        </button>
      </form>
      {error && <ErrorBanner>{messageOf(error)}</ErrorBanner>}
      <div className="inbox-list">
        {(inputs.data ?? []).map((input) => (
          <article className="inbox-item" key={input.id}>
            <div className="inbox-item-copy">
              <div>
                <span>
                  {INPUT_TYPES.find((item) => item.value === input.type)?.label ?? "입력"}
                </span>
                <time>{relativeTime(input.createdAt)}</time>
              </div>
              <strong>{input.title ?? input.content}</strong>
              {input.title && <p>{input.content}</p>}
            </div>
            <div className="inbox-item-actions">
              <button
                className="primary-button"
                onClick={() => convert.mutate(input.id)}
                disabled={convert.isPending}
              >
                작업으로 만들기
              </button>
              <button
                className="secondary-button"
                onClick={() => archive.mutate(input.id)}
                disabled={archive.isPending}
              >
                보관
              </button>
              <button
                className="inbox-delete"
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
              </button>
            </div>
          </article>
        ))}
        {!inputs.isPending && inputs.data?.length === 0 && (
          <Empty>떠오른 내용을 적어두면 나중에 작업으로 바꿀 수 있어요.</Empty>
        )}
      </div>
      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
