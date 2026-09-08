import { Button } from "@ai-pixel-office/design-system";
import styled from "styled-components";
import { Composer } from "../../../chat/components/Composer.tsx";
import { useAttachmentDraft } from "../../../chat/hooks/useAttachmentDraft.ts";

const Styled = {
  Composer: styled.form`
    display: grid;
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => theme.space.x3};
    border: 1px solid ${({ theme }) => theme.colors.border.subtle};
    border-radius: ${({ theme }) => theme.radius.xl};
    background: ${({ theme }) => theme.colors.background.surfaceRaised};

    label {
      color: ${({ theme }) => theme.colors.text.primary};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
      font-weight: ${({ theme }) => theme.typography.fontWeight.heavy};
    }
    p {
      margin: ${({ theme }) => `${theme.space.x1} 0 0`};
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
      line-height: 1.55;
    }
    textarea {
      min-height: 136px;
      resize: vertical;
      line-height: 1.55;
      border: 0;
      background: transparent;

      &:focus {
        border: 0;
        box-shadow: none;
      }
    }
  `,
  Footer: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};
    padding-top: ${({ theme }) => theme.space.x2};
    border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};

    small {
      color: ${({ theme }) => theme.colors.text.muted};
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
    }
  `,
};

export function TaskSessionComposer({
  id,
  title,
  description,
  value,
  placeholder,
  submitLabel,
  submittingLabel,
  pending,
  disabled,
  helper,
  attachmentsEnabled = true,
  onChange,
  onSubmit,
}: {
  id: string;
  title: string;
  description: string;
  value: string;
  placeholder: string;
  submitLabel: string;
  submittingLabel: string;
  pending: boolean;
  disabled: boolean;
  helper: string;
  attachmentsEnabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: (files: File[]) => Promise<unknown> | unknown;
}) {
  const attachments = useAttachmentDraft();
  const submit = async () => {
    if (disabled || pending) return;
    try {
      await onSubmit(attachments.files);
      attachments.clear();
    } catch {
      // 부모 mutation이 오류를 표시하며, 입력과 첨부는 재시도를 위해 유지한다.
    }
  };
  return (
    <Composer.Form component={Styled.Composer} attachments={attachments} disabled={disabled} pending={pending} onSubmit={submit}>
      <div>
        <label htmlFor={id}>{title}</label>
        <p>{description}</p>
      </div>
      {attachmentsEnabled && <Composer.Attachments attachments={attachments} />}
      <Composer.TextArea
        attachments={attachmentsEnabled ? attachments : undefined}
        onSubmit={submit}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={6}
      />
      <Styled.Footer>
        <small>{helper}</small>
        <Button type="submit" $variant="primary" disabled={disabled || pending}>
          {pending ? submittingLabel : submitLabel}
        </Button>
      </Styled.Footer>
    </Composer.Form>
  );
}
