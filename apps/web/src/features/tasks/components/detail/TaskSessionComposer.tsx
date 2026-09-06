import { Button, TextArea } from "@ai-pixel-office/design-system";
import styled from "styled-components";
import { isSubmitKey } from "../../../../shared/lib/keyboard.ts";

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
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Styled.Composer
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && !pending) onSubmit();
      }}
    >
      <div>
        <label htmlFor={id}>{title}</label>
        <p>{description}</p>
      </div>
      <TextArea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (isSubmitKey(event) && !disabled && !pending) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        rows={6}
      />
      <Styled.Footer>
        <small>{helper}</small>
        <Button type="submit" $variant="primary" disabled={disabled || pending}>
          {pending ? submittingLabel : submitLabel}
        </Button>
      </Styled.Footer>
    </Styled.Composer>
  );
}
