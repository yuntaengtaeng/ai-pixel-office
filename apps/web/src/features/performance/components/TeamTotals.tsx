import { Panel } from "@ai-pixel-office/design-system";
import type { PerformanceReviewSummary } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";

const Row = styled(Panel)`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.space.x4};
  padding: ${({ theme }) => theme.space.x5};

  div {
    display: grid;
    gap: ${({ theme }) => theme.space.x1};
    text-align: center;
  }

  strong {
    font-size: ${({ theme }) => theme.typography.fontSize.headingSm};
  }

  span {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.compact};
  }
`;

export function TeamTotals({ totals }: { totals: PerformanceReviewSummary["teamTotals"] }) {
  return (
    <Row>
      <div>
        <strong>{totals.assignedTaskCount}</strong>
        <span>담당 작업</span>
      </div>
      <div>
        <strong>{totals.completedTaskCount}</strong>
        <span>완료 작업</span>
      </div>
      <div>
        <strong>{Math.round(totals.completionRate * 100)}%</strong>
        <span>완료율</span>
      </div>
    </Row>
  );
}
