import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { agentApi } from "../agents/api.ts";
import { projectApi } from "../projects/api.ts";
import { taskApi } from "../tasks/api.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { Empty } from "../../shared/ui/Empty.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { SegmentedControl } from "../../shared/ui/SegmentedControl.tsx";
import { skillApi } from "./api.ts";
import { NewSkillDialog } from "./components/NewSkillDialog.tsx";
import { SkillDetailPanel } from "./components/SkillDetailPanel.tsx";
import { SkillList } from "./components/SkillList.tsx";
import {
  agentsBySkill,
  filterSkillsBySource,
  projectsBySkill,
  SKILL_SOURCE_FILTERS,
  SKILL_SOURCE_LABEL,
  type SkillSourceFilter,
} from "./utils/skillLibraryView.ts";

const Styled = {
  Intro: styled.p`
    margin-bottom: ${({ theme }) => theme.space.x4};
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    line-height: 1.5;
  `,
  Filters: styled(SegmentedControl)`
    max-width: 480px;
    border-radius: ${({ theme }) => theme.radius.lg};
    button {
      min-height: 36px;
      border-radius: ${({ theme }) => theme.radius.md};
    }
  `,
  Layout: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 1.1fr);
    gap: ${({ theme }) => theme.space.x5};
    align-items: start;
    margin-top: ${({ theme }) => theme.space.x4};
    @media ${({ theme }) => theme.mediaQuery.lg} {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
};

/** 교육 자료실: 앱 스킬 라이브러리 목록과 SKILL.md 상세 */
export function SkillsPage({ workspace }: { workspace: Workspace }) {
  const [filter, setFilter] = useState<SkillSourceFilter>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [showNewSkill, setShowNewSkill] = useState(false);
  const skills = useQuery({ queryKey: ["skills"], queryFn: () => skillApi.list() });
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const tasks = useQuery({
    queryKey: ["tasks", workspace.id],
    queryFn: () => taskApi.list(workspace.id),
  });
  const projects = useQuery({
    queryKey: ["projects", workspace.id],
    queryFn: () => projectApi.list(workspace.id),
  });
  const usage = agentsBySkill(agents.data ?? []);
  const projectUsage = projectsBySkill(agents.data ?? [], tasks.data ?? [], projects.data ?? []);
  const visibleSkills = filterSkillsBySource(skills.data ?? [], filter);
  const selectedSkillId = selectedId ?? visibleSkills[0]?.id;

  return (
    <BaseLayout>
      <PageHeader
        eyebrow="교육 자료실"
        title="스킬"
        action={
          <Button $variant="primary" onClick={() => setShowNewSkill(true)}>
            새 스킬
          </Button>
        }
      />
      <Styled.Intro>
        스킬은 Claude Code와 Codex가 그대로 읽는 표준 SKILL.md 폴더예요. 동료에게 연결하면 그 동료가
        일할 때만 쓰여요.
      </Styled.Intro>
      <Styled.Filters role="group" aria-label="스킬 출처">
        {SKILL_SOURCE_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              setSelectedId(undefined);
            }}
          >
            {value === "all" ? "전체" : SKILL_SOURCE_LABEL[value]}
          </button>
        ))}
      </Styled.Filters>
      {skills.isError && <ErrorBanner>{messageOf(skills.error)}</ErrorBanner>}
      {skills.data && visibleSkills.length === 0 ? (
        <Empty title="스킬이 없어요">조직도에서 팀을 들여오거나 새 스킬을 만들어 보세요.</Empty>
      ) : (
        <Styled.Layout>
          <SkillList
            skills={visibleSkills}
            usage={usage}
            selectedId={selectedSkillId}
            onSelect={setSelectedId}
          />
          {selectedSkillId && (
            <SkillDetailPanel
              key={selectedSkillId}
              skillId={selectedSkillId}
              usedBy={usage.get(selectedSkillId) ?? []}
              usedInProjects={projectUsage.get(selectedSkillId) ?? []}
              onRemoved={() => setSelectedId(undefined)}
            />
          )}
        </Styled.Layout>
      )}
      <NewSkillDialog
        open={showNewSkill}
        onOpenChange={setShowNewSkill}
        onCreated={setSelectedId}
      />
    </BaseLayout>
  );
}
