import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@ai-pixel-office/design-system";
import type { PerformanceReviewPeriod, Workspace } from "@ai-pixel-office/domain/entities";
import styled from "styled-components";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { FullScreenMessage } from "../../shared/ui/FullScreenMessage.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { messageOf } from "../../shared/lib/errors.ts";
import { performanceApi } from "./api.ts";
import { PERIOD_LABEL } from "./constants.ts";
import { AwardShelf } from "./components/AwardShelf.tsx";
import { MetricBarChart } from "./components/MetricBarChart.tsx";
import { TeamTotals } from "./components/TeamTotals.tsx";

const Styled = {
  Toolbar: styled.div`
    display: flex;
    justify-content: flex-end;
    margin-bottom: ${({ theme }) => theme.space.x4};

    select {
      width: 160px;
    }
  `,
  Grid: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  Note: styled.p`
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.typography.fontSize.micro};
  `,
};

export function PerformancePage({ workspace }: { workspace: Workspace }) {
  const [period, setPeriod] = useState<PerformanceReviewPeriod>("week");
  const summary = useQuery({
    queryKey: ["performance-summary", workspace.id, period],
    queryFn: () => performanceApi.summary(workspace.id, period),
  });

  if (summary.isPending) return <FullScreenMessage>회고를 준비하는 중...</FullScreenMessage>;
  if (summary.isError) return <FullScreenMessage error>{messageOf(summary.error)}</FullScreenMessage>;

  const data = summary.data;

  return (
    <BaseLayout>
      <PageHeader eyebrow="AI 팀 활동 회고" title="인사평가" />
      <Styled.Toolbar>
        <Select value={period} onChange={(event) => setPeriod(event.target.value as PerformanceReviewPeriod)}>
          {Object.entries(PERIOD_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Styled.Toolbar>
      <Styled.Grid>
        <ErrorBanner>
          이 회고는 실제 업무 품질을 단독으로 판단하는 지표가 아니에요, AI가 활동 기록을 바탕으로 정리한
          내용이에요
        </ErrorBanner>
        <TeamTotals totals={data.teamTotals} />
        <AwardShelf awards={data.awards} />
        <MetricBarChart
          title="에이전트별 완료 작업"
          rows={data.agentMetrics.map((metric) => ({
            id: metric.agentId,
            label: metric.agentName,
            value: metric.completedTaskCount,
          }))}
        />
        <MetricBarChart
          title="가장 많이 사용된 스킬"
          rows={data.skillMetrics.map((metric) => ({
            id: metric.skillId,
            label: metric.skillName,
            value: metric.usageCount,
          }))}
        />
        {data.unattributedRunSkillCount > 0 && (
          <Styled.Note>
            {data.unattributedRunSkillCount}건의 실행은 스킬 스냅샷 이전 기록이라 스킬별 통계에서 제외했어요
          </Styled.Note>
        )}
      </Styled.Grid>
    </BaseLayout>
  );
}
