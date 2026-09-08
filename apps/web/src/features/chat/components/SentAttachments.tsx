import styled from "styled-components";
import type { MessageAttachment } from "@ai-pixel-office/domain/entities";

const List = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.space.x1};
`;
const Item = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.x1};
  padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colors.background.surfaceMuted};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

/** 보낸 메시지 말풍선 아래에 실제로 전송된 첨부를 보여주고, 다운로드 링크로 원본을 다시 받을 수 있게 한다. */
export function SentAttachments({ attachments }: { attachments?: Array<Omit<MessageAttachment, "storagePath">> }) {
  if (!attachments?.length) return null;
  return (
    <List>
      {attachments.map((attachment) => (
        <Item
          key={attachment.id}
          href={`/api/attachments/${attachment.id}/download`}
          target="_blank"
          rel="noreferrer"
        >
          {attachment.mediaType.startsWith("image/") ? "🖼️" : "📎"} {attachment.name}
        </Item>
      ))}
    </List>
  );
}
