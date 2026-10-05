/** 붙여넣은 파일 (클립보드 이미지는 출처를 표시해 둠) */
export function filesFromClipboard(clipboard: DataTransfer): File[] {
  const files = [...clipboard.files];
  const incoming = files.length
    ? files
    : [...clipboard.items]
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
  for (const file of incoming) {
    Object.defineProperty(file, "__pixelOfficeAttachmentSource", {
      value: "clipboard-image",
      configurable: true,
    });
  }
  return incoming;
}

/** 끌어다 놓은 파일 */
export const filesFromDrop = (transfer: DataTransfer): File[] => [...transfer.files];
