import { useState } from "react";
import { filesFromClipboard, filesFromDrop } from "../components/AttachmentPicker.tsx";

/**
 * Composer(Chat/Task 공용)가 전송 전 첨부 목록을 관리할 때 쓰는 상태 흐름.
 * 파일 선택 버튼, 드래그 앤 드롭, 클립보드 붙여넣기가 모두 같은 add()를 거치므로
 * 중복 파일 거르는 기준(name+size)이 진입 경로와 상관없이 하나로 유지된다.
 */
export function useAttachmentDraft() {
  const [files, setFiles] = useState<File[]>([]);

  const add = (incoming: File[]) => {
    if (!incoming.length) return;
    setFiles((current) => {
      const next = [...current];
      for (const file of incoming) {
        if (!next.some((entry) => entry.name === file.name && entry.size === file.size)) next.push(file);
      }
      return next;
    });
  };

  const remove = (index: number) => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));

  const clear = () => setFiles([]);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    add(filesFromDrop(event.dataTransfer));
  };

  /** 이미지 등 파일이 있는 붙여넣기만 가로채 첨부로 승격하고, 일반 텍스트 붙여넣기는 그대로 textarea에 맡긴다. */
  const handlePaste = (event: React.ClipboardEvent) => {
    const incoming = filesFromClipboard(event.clipboardData);
    if (!incoming.length) return;
    event.preventDefault();
    add(incoming);
  };

  return { files, add, remove, clear, handleDrop, handlePaste };
}
