import { useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { CloseIcon, IconButton, PlusIcon } from "@ai-pixel-office/design-system";

const DropZone = styled.div<{ $active: boolean }>`
  display: contents;
`;
/** 배경/hover가 있는 IconButton 위에 얹어 여백을 눌러 채팅창 안에서도 도드라지게 한다. */
const AddButton = styled(IconButton)`
  flex: 0 0 auto;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;
/**
 * $stacked면 가로 한 줄 bar(ChatInputBar)에 `flex-wrap: wrap`이 걸려 있다고 가정하고,
 * `order`로 맨 앞으로 당기면서 `flex-basis: 100%`로 강제 줄바꿈시켜 칩을 입력 줄 위 자기 줄로
 * 올린다. 별도 패널로 띄우는 게 아니라 bar 자체의 정상적인 흐름 안에서 높이가 늘어나는
 * 방식이라(Claude 웹 composer와 동일한 느낌), 배경/테두리/그림자 없이 칩만 떠 보인다.
 */
const Chips = styled.div<{ $stacked?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.x1};

  ${({ $stacked }) =>
    $stacked &&
    css`
      order: -1;
      flex-basis: 100%;
    `}
`;
const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.x1};
  padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colors.background.surfaceMuted};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;
const RemoveButton = styled(IconButton)`
  color: ${({ theme }) => theme.colors.text.muted};
`;
const Thumb = styled.img`
  width: 20px;
  height: 20px;
  border-radius: ${({ theme }) => theme.radius.xs};
  object-fit: cover;
`;
/** 이미지가 아닌 파일은 미리볼 콘텐츠가 없으니, 빈 클립 아이콘 대신 확장자를 뱃지로 보여준다. */
const ExtensionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 3px;
  border-radius: ${({ theme }) => theme.radius.xs};
  background: ${({ theme }) => theme.colors.background.actionTranslucent};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: 8px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  letter-spacing: -0.02em;
`;

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1, dot + 5).toUpperCase() : "FILE";
}

/** 이미지일 때만 object URL을 만들고, 이 썸네일 하나의 mount 동안만 살려두다가 파일 교체·chip 제거·언마운트 시 바로 revoke한다. */
function AttachmentThumbnail({ file }: { file: File }) {
  const isImage = file.type.startsWith("image/");
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!isImage) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, isImage]);
  return url ? <Thumb src={url} alt="" /> : <ExtensionBadge>{fileExtension(file.name)}</ExtensionBadge>;
}

export function filesFromClipboard(clipboard: DataTransfer): File[] {
  const files = [...clipboard.files];
  const incoming = files.length ? files : [...clipboard.items]
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

export const filesFromDrop = (transfer: DataTransfer): File[] => [...transfer.files];

export function AttachmentPicker({
  files,
  onAdd,
  onRemove,
  $stacked,
}: {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  $stacked?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <DropZone $active={false}>
      <AddButton type="button" $size={28} aria-label="파일 또는 이미지 추가" title="파일 또는 이미지 추가" onClick={() => inputRef.current?.click()}>
        <PlusIcon size={16} />
      </AddButton>
      <input ref={inputRef} hidden type="file" multiple onChange={(event) => { onAdd([...event.target.files ?? []]); event.currentTarget.value = ""; }} />
      {files.length > 0 && (
        <Chips $stacked={$stacked}>
          {files.map((file, index) => (
            <Chip key={`${file.name}-${file.size}-${index}`}>
              <AttachmentThumbnail file={file} /> {file.name}
              <RemoveButton type="button" $size={16} aria-label={`${file.name} 제거`} title="제거" onClick={() => onRemove(index)}>
                <CloseIcon size={12} />
              </RemoveButton>
            </Chip>
          ))}
        </Chips>
      )}
    </DropZone>
  );
}
