import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import {
  Button,
  Dialog,
  Field,
  HelperText,
  Input,
  Kicker,
  TextArea,
  useDialogIds,
} from "@ai-pixel-office/design-system";
import { messageOf } from "../../../shared/lib/errors.ts";
import { isSubmitKey } from "../../../shared/lib/keyboard.ts";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner.tsx";
import { skillApi } from "../api.ts";

const EMPTY_FORM = { id: "", description: "", category: "", instructions: "" };

const Styled = {
  Dialog: styled(Dialog)`
    .dialog-content {
      width: min(720px, calc(100vw - 28px));
      max-height: calc(100vh - 32px);
      overflow: auto;
      background: ${({ theme }) => theme.colors.background.surfaceRaised};
    }
  `,
  Form: styled.form`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
    h2 {
      font-family: ${({ theme }) => theme.typography.fontFamily.serif};
      font-size: ${({ theme }) => theme.typography.fontSize.heading2xl};
    }
    p {
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.base};
      line-height: 1.55;
    }
  `,
  Draft: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x2};
    padding: ${({ theme }) => theme.space.x4};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    border-radius: ${({ theme }) => theme.radius.lg};
  `,
  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.space.x2};
  `,
  Mono: styled(Input)`
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  `,
};

/** 새 스킬 작성 대화상자 (AI 초안으로 SKILL.md 내용을 채우고 저장) */
export function NewSkillDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (skillId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { titleId, descriptionId } = useDialogIds();
  const [brief, setBrief] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [requiredPermissions, setRequiredPermissions] = useState<string[]>([]);
  const update = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const draft = useMutation({
    mutationFn: () => skillApi.generateDraft(brief),
    onSuccess: (generated) => {
      setForm({
        id: generated.id,
        description: generated.description,
        category: generated.category,
        instructions: generated.instructions,
      });
      setRequiredPermissions(generated.requiredPermissions);
    },
  });
  const create = useMutation({
    mutationFn: () =>
      skillApi.create({
        id: form.id.trim(),
        title: form.id.trim(),
        description: form.description,
        category: form.category || "기타",
        instructions: form.instructions,
        requiredPermissions,
      }),
    onSuccess: (skill) => {
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
      setBrief("");
      setForm(EMPTY_FORM);
      setRequiredPermissions([]);
      onCreated(skill.id);
      onOpenChange(false);
    },
  });

  return (
    <Styled.Dialog
      open={open}
      onOpenChange={onOpenChange}
      titleId={titleId}
      descriptionId={descriptionId}
    >
      <Styled.Form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <Kicker>새 스킬</Kicker>
          <h2 id={titleId}>SKILL.md 만들기</h2>
          <p id={descriptionId}>
            Claude Code와 Codex가 그대로 읽는 표준 스킬 폴더로 저장돼요. 이름이 곧 런타임에서 부르는
            이름이에요.
          </p>
        </div>
        <Styled.Draft>
          <Field>
            <label htmlFor="skill-brief">어떤 일을 반복해서 잘했으면 하나요?</label>
            <TextArea
              id="skill-brief"
              rows={3}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              onKeyDown={(event) => {
                if (isSubmitKey(event, "modifier-enter") && brief.trim() && !draft.isPending) {
                  event.preventDefault();
                  draft.mutate();
                }
              }}
              placeholder="예: Figma 링크를 받으면 간격과 타이포그래피를 검토하고 개선안을 정리해 줘"
            />
          </Field>
          <Button
            type="button"
            $variant="secondary"
            disabled={!brief.trim() || draft.isPending}
            onClick={() => draft.mutate()}
          >
            {draft.isPending ? "AI가 초안을 만드는 중" : "AI로 초안 채우기"}
          </Button>
          {draft.isError && <ErrorBanner>{messageOf(draft.error)}</ErrorBanner>}
        </Styled.Draft>
        <Field>
          <label htmlFor="skill-id">이름</label>
          <Styled.Mono
            id="skill-id"
            value={form.id}
            onChange={(event) => update("id", event.target.value)}
            placeholder="figma-ui-review"
            required
          />
          <HelperText>소문자, 숫자, 하이픈(-)만 써요.</HelperText>
        </Field>
        <Field>
          <label htmlFor="skill-description">언제 쓰는 스킬인가요?</label>
          <Input
            id="skill-description"
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            required
          />
        </Field>
        <Field>
          <label htmlFor="skill-category">분류</label>
          <Input
            id="skill-category"
            value={form.category}
            onChange={(event) => update("category", event.target.value)}
            placeholder="디자인"
          />
        </Field>
        <Field>
          <label htmlFor="skill-instructions">본문 (SKILL.md)</label>
          <TextArea
            id="skill-instructions"
            rows={10}
            value={form.instructions}
            onChange={(event) => update("instructions", event.target.value)}
            required
          />
        </Field>
        {requiredPermissions.length > 0 && (
          <HelperText>AI가 제안한 필요 권한: {requiredPermissions.join(", ")}</HelperText>
        )}
        {create.isError && <ErrorBanner>{messageOf(create.error)}</ErrorBanner>}
        <Styled.Actions>
          <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type="submit" $variant="primary" disabled={create.isPending}>
            스킬 저장
          </Button>
        </Styled.Actions>
      </Styled.Form>
    </Styled.Dialog>
  );
}
