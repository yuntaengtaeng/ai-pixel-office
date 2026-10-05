import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import styled from "styled-components";
import { Button } from "@ai-pixel-office/design-system";
import type { Workspace } from "@ai-pixel-office/domain/entities";
import { messageOf } from "../../shared/lib/errors.ts";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { PageHeader } from "../../shared/ui/PageHeader.tsx";
import { systemApi } from "../system/api.ts";
import { teamApi } from "../teams/api.ts";
import { TeamPackageCard } from "../teams/TeamPackageCard.tsx";
import { agentApi } from "./api.ts";
import { NewColleagueDialog } from "./components/NewColleagueDialog.tsx";
import { TeamMembers } from "./components/TeamMembers.tsx";
import { groupAgentsByTeam } from "./utils/orgChart.ts";

const Styled = {
  Sections: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.space.x5};
  `,
};

/** 조직도: 팀과 동료 사원증, 팀 들여오기, 동료 추가 */
export function OrgChartPage({ workspace }: { workspace: Workspace }) {
  const [showNewColleague, setShowNewColleague] = useState(false);
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const teams = useQuery({
    queryKey: ["teams", workspace.id],
    queryFn: () => teamApi.list(workspace.id),
  });
  const runtimeStatus = useQuery({ queryKey: ["system-status"], queryFn: systemApi.status });
  const connectedRuntimes = (["claude", "codex"] as const).filter(
    (runtime) => runtimeStatus.data?.[runtime].authenticated,
  );
  const org = groupAgentsByTeam(agents.data ?? [], teams.data ?? []);

  return (
    <BaseLayout>
      <PageHeader
        eyebrow="조직도"
        title="우리 팀"
        action={
          <Button $variant="primary" onClick={() => setShowNewColleague(true)}>
            동료 추가
          </Button>
        }
      />
      {(agents.isError || teams.isError) && (
        <ErrorBanner>{messageOf(agents.error ?? teams.error)}</ErrorBanner>
      )}
      <Styled.Sections>
        {org.teams.map(({ team, members }) =>
          members.length > 0 ? (
            <TeamMembers
              key={team.id}
              title={team.name}
              subtitle={`${team.version} · ${team.description}`}
              members={members}
            />
          ) : (
            <TeamPackageCard
              key={team.id}
              team={team}
              workspaceId={workspace.id}
              connectedRuntimes={[...connectedRuntimes]}
            />
          ),
        )}
        {org.unaffiliated.length > 0 && (
          <TeamMembers title="팀에 속하지 않은 동료" members={org.unaffiliated} />
        )}
      </Styled.Sections>
      <NewColleagueDialog
        open={showNewColleague}
        onOpenChange={setShowNewColleague}
        workspaceId={workspace.id}
        connectedRuntimes={[...connectedRuntimes]}
      />
    </BaseLayout>
  );
}
