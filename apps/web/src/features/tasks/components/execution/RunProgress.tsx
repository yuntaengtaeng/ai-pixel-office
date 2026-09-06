import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Empty } from "../../../../shared/ui/Empty.tsx";
import type { TaskDetail } from "../../api.ts";

const Container = styled.details`
  margin-top: ${({ theme }) => theme.space.x1};
  padding-top: ${({ theme }) => theme.space.x4};
  border-top: 2px dashed ${({ theme }) => theme.colors.border.subtle};
`;
const Heading = styled.summary`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.space.x2};
  color: ${({ theme }) => theme.colors.text.positive};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};
  cursor: pointer;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }

  span {
    padding: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
    background: ${({ theme }) => theme.colors.background.positiveSubtle};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  }
`;
const List = styled.div`
  max-height: 230px;
  overflow: auto;
  display: grid;
`;
const Event = styled.div<{ $type: string }>`
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: ${({ theme }) => theme.space.x2};
  padding: ${({ theme }) => `${theme.space.x2} ${theme.space.x1}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
  > span {
    color: ${({ $type, theme }) => ($type === "permission_requested" ? theme.colors.text.negative : theme.colors.text.secondary)};
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
    font-weight: ${({ theme }) => theme.typography.fontWeight.black};
  }
  div {
    min-width: 0;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: ${({ theme }) => `${theme.space.x1} ${theme.space.x2}`};
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  code {
    grid-column: 1 / -1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
  }
  time {
    grid-column: 2;
    grid-row: 1;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
  }
`;

export function RunProgress({ events }: { events: TaskDetail["progress"] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const hasIssue = events.some((event) => event.type === "permission_requested");
  const [open, setOpen] = useState(hasIssue);
  useEffect(() => {
    if (hasIssue) setOpen(true);
  }, [hasIssue]);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [events.length]);
  return (
    <Container open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <Heading>
        <strong>실시간 진행 · 무슨 일이 일어나고 있어요?</strong>
        <span>{events.length}</span>
      </Heading>
      <List ref={listRef}>
        {events.slice(-30).map((event) => (
          <Event $type={event.type} key={event.id}>
            <span>
              {event.type === "tool_started"
                ? "▶"
                : event.type === "tool_completed"
                  ? "✓"
                  : event.type === "permission_requested"
                    ? "!"
                    : "·"}
            </span>
            <div>
              <p>{event.message}</p>
              {typeof event.metadata?.detail === "string" && <code>{event.metadata.detail}</code>}
              <time>{new Date(event.createdAt).toLocaleTimeString("ko-KR")}</time>
            </div>
          </Event>
        ))}
        {events.length === 0 && <Empty>첫 번째 실행 이벤트를 기다리는 중...</Empty>}
      </List>
    </Container>
  );
}
