import { useMutation, useQueryClient } from "@tanstack/react-query";
import styled from "styled-components";
import type { AgentModel } from "@ai-pixel-office/domain/entities";
import { Button, HelperText, Panel } from "@ai-pixel-office/design-system";
import { ErrorBanner } from "../../shared/ui/ErrorBanner.tsx";
import { messageOf } from "../../shared/lib/errors.ts";
import { PetPreview } from "../office/PetPreview.tsx";
import { chooseTeamRuntime, teamApi, type TeamSummary } from "./api.ts";

const Styled = {
  Card: styled(Panel).attrs({ as: "section" })`
    padding: ${({ theme }) => theme.space.x5};
    display: grid;
    gap: ${({ theme }) => theme.space.x4};
  `,
  Header: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space.x3};
    h2 {
      font-size: ${({ theme }) => theme.typography.fontSize.headingSm};
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    }
    p {
      margin-top: ${({ theme }) => theme.space.x1};
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.lg};
      line-height: 1.5;
    }
  `,
  Members: styled.ul`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: ${({ theme }) => theme.space.x3};
  `,
  Member: styled.li`
    display: grid;
    grid-template-columns: 44px 1fr;
    align-items: center;
    gap: ${({ theme }) => theme.space.x3};
    padding: ${({ theme }) => theme.space.x3};
    border-radius: ${({ theme }) => theme.radius.lg};
    background: ${({ theme }) => theme.colors.background.surfaceMuted};
    strong {
      font-size: ${({ theme }) => theme.typography.fontSize.lg};
    }
    span {
      display: block;
      margin-top: 2px;
      color: ${({ theme }) => theme.colors.text.secondary};
      font-size: ${({ theme }) => theme.typography.fontSize.md};
    }
  `,
};

/** bundled Team 하나를 소개하고 한 번에 설치하는 카드 */
export function TeamPackageCard({
  team,
  workspaceId,
  connectedRuntimes,
}: {
  team: TeamSummary;
  workspaceId: string;
  connectedRuntimes: AgentModel[];
}) {
  const queryClient = useQueryClient();
  const runtime = chooseTeamRuntime(connectedRuntimes);
  const install = useMutation({
    mutationFn: (selected: AgentModel) =>
      teamApi.install(team.id, { workspaceId, runtime: selected }),
    onSuccess: () => {
      for (const key of ["agents", "skills", "teams"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
  const installed = team.installed || install.isSuccess;

  return (
    <Styled.Card>
      <Styled.Header>
        <div>
          <h2>{team.name} 사용하기</h2>
          <p>
            {team.description}. 동료 {team.members.length}명과 스킬을 한 번에 준비해요.
          </p>
        </div>
        <Button
          type="button"
          $variant="primary"
          disabled={installed || !runtime || install.isPending}
          onClick={() => runtime && install.mutate(runtime)}
        >
          {installed ? "준비 완료" : install.isPending ? "준비하는 중" : `${team.name} 사용하기`}
        </Button>
      </Styled.Header>
      <Styled.Members>
        {team.members.map((member) => (
          <Styled.Member key={member.key}>
            <PetPreview petId={member.avatarId} size={44} />
            <div>
              <strong>
                {member.name} · {member.role}
              </strong>
              <span>{member.description}</span>
            </div>
          </Styled.Member>
        ))}
      </Styled.Members>
      {!runtime && <HelperText>AI를 연결하면 팀을 만들 수 있어요.</HelperText>}
      {install.isError && <ErrorBanner>{messageOf(install.error)}</ErrorBanner>}
    </Styled.Card>
  );
}
