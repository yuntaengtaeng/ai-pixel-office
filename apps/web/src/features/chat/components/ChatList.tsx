import type { Agent, Task } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";
import { Button, Panel } from "@ai-pixel-office/design-system";
import { PetPreview } from "../../office/PetPreview.tsx";
import { Empty } from "../../../shared/ui/Empty.tsx";
import { EndedTag } from "./ChatFrame.tsx";

const Frame = styled(Panel)`
  height: 100%;
  padding: ${({ theme }) => theme.space.x3};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.x3};
  overflow: hidden;

  > button {
    flex: 0 0 auto;
  }
`;

const List = styled.ul`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  align-content: start;
  border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const Row = styled.li<{ $active: boolean; $ended: boolean }>`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
  opacity: ${({ $ended }) => ($ended ? 0.55 : 1)};

  button {
    width: 100%;
    padding: ${({ theme }) => theme.space.x3} ${({ theme }) => theme.space.x2};
    border: 0;
    background: ${({ $active, theme }) =>
      $active ? theme.colors.background.positiveSubtle : "transparent"};
    border-left: 3px solid
      ${({ $active, theme }) => ($active ? theme.colors.border.positive : "transparent")};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space.x2};
    text-align: left;
    cursor: pointer;

    &:hover {
      background: ${({ theme }) => theme.colors.background.surfaceMuted};
    }
  }

  div {
    min-width: 0;
    display: grid;
  }

  strong {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
  }

  span {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
  }
`;

const MetaRow = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.x1};
`;

export function ChatList({
  chats,
  agents,
  activeTaskId,
  onSelect,
  onNewChat,
}: {
  chats: Task[];
  agents: Agent[];
  activeTaskId?: string;
  onSelect: (taskId: string) => void;
  onNewChat: () => void;
}) {
  return (
    <Frame>
      <Button $variant="primary" onClick={onNewChat}>
        + 새 대화
      </Button>
      <List>
        {chats.map((chat) => {
          const agent = agents.find((candidate) => candidate.id === chat.assigneeAgentId);
          return (
            <Row key={chat.id} $active={chat.id === activeTaskId} $ended={chat.status === "done"}>
              <button onClick={() => onSelect(chat.id)}>
                <PetPreview petId={agent?.avatarId ?? ""} size={32} />
                <div>
                  <strong>{chat.title}</strong>
                  <MetaRow>
                    <span>{agent?.name ?? "담당자 미정"}</span>
                    {chat.status === "done" && <EndedTag>종료됨</EndedTag>}
                  </MetaRow>
                </div>
              </button>
            </Row>
          );
        })}
        {chats.length === 0 && <Empty>아직 나눈 대화가 없어요</Empty>}
      </List>
    </Frame>
  );
}
