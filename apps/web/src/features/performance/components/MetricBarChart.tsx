import { Panel } from "@ai-pixel-office/design-system";
import styled from "styled-components";
import { Empty } from "../../../shared/ui/Empty.tsx";

const Section = styled(Panel)`
  padding: ${({ theme }) => theme.space.x5};
  display: grid;
  gap: ${({ theme }) => theme.space.x3};

  h2 {
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    margin: 0;
  }
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.space.x2};
`;

const Row = styled.li`
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 48px;
  align-items: center;
  gap: ${({ theme }) => theme.space.x2};
  font-size: ${({ theme }) => theme.typography.fontSize.compact};

  > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span:last-child {
    text-align: right;
    color: ${({ theme }) => theme.colors.text.muted};
  }
`;

const Track = styled.div`
  height: 14px;
  background: ${({ theme }) => theme.colors.background.surfaceMuted};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const Fill = styled.div<{ $ratio: number }>`
  height: 100%;
  width: ${({ $ratio }) => Math.round($ratio * 100)}%;
  background: ${({ theme }) => theme.colors.brand.primary};
`;

export type BarChartRow = { id: string; label: string; value: number };

export function MetricBarChart({ title, rows }: { title: string; rows: BarChartRow[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <Section as="section">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <Empty>표시할 활동이 아직 없어요</Empty>
      ) : (
        <List>
          {rows.map((row) => (
            <Row key={row.id}>
              <span>{row.label}</span>
              <Track>
                <Fill $ratio={row.value / max} />
              </Track>
              <span>{row.value}</span>
            </Row>
          ))}
        </List>
      )}
    </Section>
  );
}
