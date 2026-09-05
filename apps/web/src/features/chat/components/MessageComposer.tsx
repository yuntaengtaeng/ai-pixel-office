import { useEffect, useRef, useState } from "react";
import { Button, TextArea } from "@ai-pixel-office/design-system";
import { ChatInputBar } from "./ChatFrame.tsx";
import { isSubmitKey } from "../../../shared/lib/keyboard.ts";

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
  onSend: (message: string) => void;
  placeholder: string;
  disabled?: boolean;
  pending?: boolean;
  pendingLabel?: string;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!pending) submittingRef.current = false;
  }, [pending]);

  const submit = () => {
    const message = draft.trim();
    if (!message || disabled || pending || submittingRef.current) return;
    submittingRef.current = true;
    setDraft("");
    onSend(message);
  };

  return (
    <ChatInputBar
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextArea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (isSubmitKey(event)) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <Button $variant="primary" type="submit" disabled={pending || !draft.trim() || disabled}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </ChatInputBar>
  );
}
