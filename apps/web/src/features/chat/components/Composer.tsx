import type { ComponentProps, ElementType, ReactNode } from "react";
import { TextArea } from "@ai-pixel-office/design-system";
import { isSubmitKey } from "../../../shared/lib/keyboard.ts";
import { AttachmentPicker } from "./AttachmentPicker.tsx";
import type { useAttachmentDraft } from "../hooks/useAttachmentDraft.ts";

type AttachmentDraft = ReturnType<typeof useAttachmentDraft>;

/**
 * Chat/Task 작성기가 같은 "전체 영역 드롭 + Enter 전송 + 파일 붙여넣기" 규칙을 공유하지만
 * 시각 레이아웃(가로 bar vs 헤더/푸터가 있는 카드)은 다르므로, 규칙은 여기서 한 번만 구현하고
 * `component`로 각자의 styled shell을 넘겨 조립하게 한다.
 */
function ComposerForm<TComponent extends ElementType>({
  component: Form,
  attachments,
  disabled,
  pending,
  onSubmit,
  children,
  ...rest
}: {
  component: TComponent;
  attachments?: AttachmentDraft;
  disabled?: boolean;
  pending?: boolean;
  onSubmit: () => void;
  children: ReactNode;
} & Omit<ComponentProps<TComponent>, "component" | "onSubmit" | "onDrop" | "onDragOver" | "children">) {
  const Component = Form as ElementType;
  return (
    <Component
      onDragOver={(event: React.DragEvent) => event.preventDefault()}
      onDrop={attachments?.handleDrop}
      onSubmit={(event: React.FormEvent) => {
        event.preventDefault();
        if (!disabled && !pending) onSubmit();
      }}
      {...rest}
    >
      {children}
    </Component>
  );
}

function ComposerTextArea({
  attachments,
  onSubmit,
  ...rest
}: {
  attachments?: AttachmentDraft;
  onSubmit: () => void;
} & ComponentProps<typeof TextArea>) {
  return (
    <TextArea
      {...rest}
      onKeyDown={(event) => {
        if (isSubmitKey(event)) {
          event.preventDefault();
          onSubmit();
        }
      }}
      onPaste={attachments?.handlePaste}
    />
  );
}

function ComposerAttachments({
  attachments,
  $stacked,
}: {
  attachments: AttachmentDraft;
  /** 가로 bar 레이아웃에서 칩을 입력 줄 위 자기 줄로 올려, bar 높이가 자연스럽게 늘어나게 한다. */
  $stacked?: boolean;
}) {
  return (
    <AttachmentPicker
      files={attachments.files}
      onAdd={attachments.add}
      onRemove={attachments.remove}
      $stacked={$stacked}
    />
  );
}

export const Composer = {
  Form: ComposerForm,
  TextArea: ComposerTextArea,
  Attachments: ComposerAttachments,
};
