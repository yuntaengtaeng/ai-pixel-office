import type { Agent } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";
import { PetPreview } from "../../office/PetPreview.tsx";

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.x2};
`;

const Card = styled.button<{ $selected: boolean }>`
  width: 96px;
  padding: ${({ theme }) => theme.space.x2};
  border: 1px solid
    ${({ $selected, theme }) => ($selected ? theme.colors.border.positive : theme.colors.border.subtle)};
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.background.positiveSubtle : theme.colors.background.surfaceRaised};
  border-radius: ${({ theme }) => theme.radius.md};
  display: grid;
  justify-items: center;
  gap: ${({ theme }) => theme.space.x1};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.border.positive};
  }

  span {
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
  }
`;

export function RecipientChips({
  agents,
  selectedId,
  onSelect,
}: {
  agents: Agent[];
  selectedId?: string;
  onSelect: (agentId: string) => void;
}) {
  return (
    <Row>
      {agents.map((agent) => (
        <Card
          key={agent.id}
          type="button"
          $selected={agent.id === selectedId}
          onClick={() => onSelect(agent.id)}
        >
          <PetPreview petId={agent.avatarId ?? ""} size={40} />
          <span>{agent.name}</span>
        </Card>
      ))}
    </Row>
  );
}
