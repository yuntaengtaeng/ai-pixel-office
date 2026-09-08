import { useEffect, useRef, useState } from "react";
import { Button } from "@ai-pixel-office/design-system";
import { ChatInputBar } from "./ChatFrame.tsx";
import { Composer } from "./Composer.tsx";
import { useAttachmentDraft } from "../hooks/useAttachmentDraft.ts";

/** draft를 컴포저 내부에 가둬서, 부모는 확정된 메시지 문자열만 받고 draft 상태/초기화를 신경 쓰지 않아도 됨 */
export function MessageComposer({
  onSend,
  placeholder,
  disabled,
  pending,
  pendingLabel,
  submitLabel = "보내기",
  autoFocus,
}: {
  onSend: (message: string, files?: File[]) => Promise<unknown>;
  placeholder: string;
  disabled?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const attachments = useAttachmentDraft();
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!pending) submittingRef.current = false;
  }, [pending]);

  const submit = async () => {
    const message = draft.trim();
    if (!message || disabled || pending || submittingRef.current) return;
    submittingRef.current = true;
    try {
      await onSend(message, attachments.files);
      setDraft("");
      attachments.clear();
    } catch {
      submittingRef.current = false;
    }
  };

  return (
    <Composer.Form component={ChatInputBar} attachments={attachments} disabled={disabled} pending={pending} onSubmit={submit}>
      <Composer.TextArea
        attachments={attachments}
        onSubmit={submit}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <Composer.Attachments attachments={attachments} $stacked />
      <Button $variant="primary" type="submit" disabled={pending || !draft.trim() || disabled}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </Composer.Form>
  );
}
